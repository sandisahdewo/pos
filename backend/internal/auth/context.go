package auth

import "context"

type ctxKey int

const claimsCtxKey ctxKey = iota

// WithClaims attaches JWT claims to a context. Used by the auth middleware
// after validating the bearer token.
func WithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsCtxKey, c)
}

// ClaimsFrom extracts the claims attached by WithClaims. Returns ok=false when
// the context has no claims (e.g., request hit a public route).
func ClaimsFrom(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsCtxKey).(*Claims)
	return c, ok
}
