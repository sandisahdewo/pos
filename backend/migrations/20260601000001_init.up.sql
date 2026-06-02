SET statement_timeout = 0;

--bun:split

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--bun:split

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    phone         TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'active',
    joined_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
    pin           TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- PIN must be unique when set. Empty PIN is allowed for users who don't
-- operate the till (managers, accountants, etc.).
CREATE UNIQUE INDEX users_pin_unique ON users(pin) WHERE pin <> '';

--bun:split

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    -- System roles can have description edited but name + permissions locked
    -- by the API (mirroring the frontend convention before integration).
    is_system   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- Permission strings are application-level identifiers like 'menu.dashboard'
-- or the wildcard '*' (granted to admin). The string itself isn't FK'd to a
-- separate table — the catalog lives in the frontend at lib/auth/permissions.ts.
CREATE TABLE role_permissions (
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    PRIMARY KEY (role_id, permission)
);

--bun:split

CREATE TABLE user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

--bun:split

CREATE TABLE units (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE TABLE suppliers (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    contact_person TEXT        NOT NULL DEFAULT '',
    email          TEXT        NOT NULL DEFAULT '',
    phone          TEXT        NOT NULL DEFAULT '',
    address        TEXT        NOT NULL DEFAULT '',
    lead_time_days INTEGER     NOT NULL DEFAULT 0,
    status         TEXT        NOT NULL DEFAULT 'active',
    notes          TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- Tax rates use a TEXT primary key (slug-style) because they're a small
-- closed set referenced by product / category seed data using well-known
-- identifiers (tax_ppn11, tax_exempt, tax_zero). Keeping the IDs stable
-- across reseeds avoids needing to rewrite product seed UUIDs.
CREATE TABLE tax_rates (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    rate        NUMERIC(6,3) NOT NULL DEFAULT 0,
    description TEXT        NOT NULL DEFAULT '',
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- At most one default tax rate at a time. Partial unique index enforces it.
CREATE UNIQUE INDEX tax_rates_one_default ON tax_rates ((is_default)) WHERE is_default;

--bun:split

CREATE TABLE categories (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    slug         TEXT        NOT NULL UNIQUE,
    description  TEXT        NOT NULL DEFAULT '',
    color        TEXT        NOT NULL DEFAULT 'neutral',
    -- Tax rate is optional at the category level — empty means inherit from
    -- the parent (walked at read time) or fall back to the default rate.
    tax_rate_id  TEXT        REFERENCES tax_rates(id) ON DELETE RESTRICT,
    parent_id    UUID        REFERENCES categories(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE INDEX categories_parent_idx ON categories(parent_id);

--bun:split

CREATE TABLE brands (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    image_url   TEXT        NOT NULL DEFAULT '',
    status      TEXT        NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE TABLE tags (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL UNIQUE,
    color          TEXT        NOT NULL DEFAULT 'neutral',
    public_visible BOOLEAN     NOT NULL DEFAULT true,
    description    TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
