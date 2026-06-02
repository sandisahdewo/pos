SET statement_timeout = 0;

--bun:split

DROP INDEX IF EXISTS locations_one_default_receipt;

--bun:split

DROP TABLE IF EXISTS locations;

--bun:split

DROP TABLE IF EXISTS tags;

--bun:split

DROP TABLE IF EXISTS brands;

--bun:split

DROP INDEX IF EXISTS categories_parent_idx;

--bun:split

DROP TABLE IF EXISTS categories;

--bun:split

DROP INDEX IF EXISTS tax_rates_one_default;

--bun:split

DROP TABLE IF EXISTS tax_rates;

--bun:split

DROP TABLE IF EXISTS suppliers;

--bun:split

DROP TABLE IF EXISTS units;

--bun:split

DROP TABLE IF EXISTS user_roles;

--bun:split

DROP TABLE IF EXISTS role_permissions;

--bun:split

DROP TABLE IF EXISTS roles;

--bun:split

DROP INDEX IF EXISTS users_pin_unique;

--bun:split

DROP TABLE IF EXISTS users;
