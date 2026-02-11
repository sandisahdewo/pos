package model

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate *validator.Validate

func init() {
	validate = validator.New(validator.WithRequiredStructEnabled())
}

// Validate validates a struct and returns a user-friendly error map on failure.
func Validate(s any) error {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}

	validationErrors, ok := err.(validator.ValidationErrors)
	if !ok {
		return &AppError{
			Code:    422,
			Message: "validation failed",
			Err:     err,
		}
	}

	details := make(map[string]string, len(validationErrors))
	for _, fe := range validationErrors {
		field := toSnakeCase(fe.Field())
		details[field] = formatFieldError(fe)
	}

	return &AppError{
		Code:    422,
		Message: fmt.Sprintf("validation failed: %s", summarize(details)),
	}
}

// ValidateWithDetails validates and returns details map separately for the error response.
func ValidateWithDetails(s any) (map[string]string, error) {
	err := validate.Struct(s)
	if err == nil {
		return nil, nil
	}

	validationErrors, ok := err.(validator.ValidationErrors)
	if !ok {
		return nil, err
	}

	details := make(map[string]string, len(validationErrors))
	for _, fe := range validationErrors {
		field := toSnakeCase(fe.Field())
		details[field] = formatFieldError(fe)
	}

	return details, fmt.Errorf("validation failed")
}

func formatFieldError(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "this field is required"
	case "email":
		return "must be a valid email address"
	case "min":
		return fmt.Sprintf("must be at least %s characters", fe.Param())
	case "max":
		return fmt.Sprintf("must be at most %s characters", fe.Param())
	case "uuid":
		return "must be a valid UUID"
	default:
		return fmt.Sprintf("failed on %s validation", fe.Tag())
	}
}

func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteByte('_')
		}
		result.WriteRune(r)
	}
	return strings.ToLower(result.String())
}

func summarize(details map[string]string) string {
	parts := make([]string, 0, len(details))
	for field, msg := range details {
		parts = append(parts, field+": "+msg)
	}
	return strings.Join(parts, "; ")
}
