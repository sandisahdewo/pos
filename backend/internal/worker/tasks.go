package worker

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const (
	TypeEmailVerification = "email:verification"
	TypePasswordReset     = "email:password_reset"
	TypeInvitationEmail   = "email:invitation"
)

// Email verification payload
type EmailVerificationPayload struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Token  string    `json:"token"`
}

func NewEmailVerificationTask(userID uuid.UUID, email, token string) (*asynq.Task, error) {
	payload, err := json.Marshal(EmailVerificationPayload{
		UserID: userID,
		Email:  email,
		Token:  token,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeEmailVerification, payload,
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
		asynq.Queue("critical"),
	), nil
}

// Password reset payload
type PasswordResetPayload struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Token  string    `json:"token"`
}

func NewPasswordResetTask(userID uuid.UUID, email, token string) (*asynq.Task, error) {
	payload, err := json.Marshal(PasswordResetPayload{
		UserID: userID,
		Email:  email,
		Token:  token,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypePasswordReset, payload,
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
		asynq.Queue("critical"),
	), nil
}

// Invitation email payload
type InvitationEmailPayload struct {
	Email      string `json:"email"`
	Token      string `json:"token"`
	TenantName string `json:"tenant_name"`
}

func NewInvitationEmailTask(email, token, tenantName string) (*asynq.Task, error) {
	payload, err := json.Marshal(InvitationEmailPayload{
		Email:      email,
		Token:      token,
		TenantName: tenantName,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeInvitationEmail, payload,
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
		asynq.Queue("critical"),
	), nil
}
