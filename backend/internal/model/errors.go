package model

import (
	"errors"
	"fmt"
	"net/http"
)

// AppError is a domain error that carries an HTTP status code and user-facing message.
type AppError struct {
	Code    int    `json:"-"`
	Message string `json:"message"`
	Err     error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// NewAppError creates a new AppError with the given HTTP status code and message.
func NewAppError(code int, message string, err error) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// Predefined application errors.
var (
	ErrNotFound     = &AppError{Code: http.StatusNotFound, Message: "resource not found"}
	ErrUnauthorized = &AppError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbidden    = &AppError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrConflict     = &AppError{Code: http.StatusConflict, Message: "resource already exists"}
	ErrValidation   = &AppError{Code: http.StatusUnprocessableEntity, Message: "validation failed"}
	ErrInternal     = &AppError{Code: http.StatusInternalServerError, Message: "internal server error"}
)

// Error constructors for wrapping underlying errors with context.

func NotFoundError(msg string) *AppError {
	return &AppError{Code: http.StatusNotFound, Message: msg}
}

func UnauthorizedError(msg string) *AppError {
	return &AppError{Code: http.StatusUnauthorized, Message: msg}
}

func ForbiddenError(msg string) *AppError {
	return &AppError{Code: http.StatusForbidden, Message: msg}
}

func ConflictError(msg string) *AppError {
	return &AppError{Code: http.StatusConflict, Message: msg}
}

func ValidationError(msg string) *AppError {
	return &AppError{Code: http.StatusUnprocessableEntity, Message: msg}
}

func InternalError(msg string, err error) *AppError {
	return &AppError{Code: http.StatusInternalServerError, Message: msg, Err: err}
}

// IsAppError checks if an error is an AppError and returns it.
func IsAppError(err error) (*AppError, bool) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr, true
	}
	return nil, false
}
