package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/hibiken/asynq"

	"pos/internal/service"
)

type TaskHandlers struct {
	email *service.EmailService
}

func NewTaskHandlers(email *service.EmailService) *TaskHandlers {
	return &TaskHandlers{email: email}
}

func (h *TaskHandlers) HandleEmailVerification(ctx context.Context, t *asynq.Task) error {
	var payload EmailVerificationPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("sending verification email", "email", payload.Email, "user_id", payload.UserID)

	if err := h.email.SendVerificationEmail(payload.Email, payload.Token); err != nil {
		return fmt.Errorf("send verification email: %w", err)
	}

	return nil
}

func (h *TaskHandlers) HandlePasswordReset(ctx context.Context, t *asynq.Task) error {
	var payload PasswordResetPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("sending password reset email", "email", payload.Email, "user_id", payload.UserID)

	if err := h.email.SendPasswordResetEmail(payload.Email, payload.Token); err != nil {
		return fmt.Errorf("send password reset email: %w", err)
	}

	return nil
}

func (h *TaskHandlers) HandleInvitationEmail(ctx context.Context, t *asynq.Task) error {
	var payload InvitationEmailPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("sending invitation email", "email", payload.Email, "tenant", payload.TenantName)

	if err := h.email.SendInvitationEmail(payload.Email, payload.Token, payload.TenantName); err != nil {
		return fmt.Errorf("send invitation email: %w", err)
	}

	return nil
}
