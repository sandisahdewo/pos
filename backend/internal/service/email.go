package service

import (
	"fmt"
	"html"

	mail "github.com/wneessen/go-mail"

	"pos/internal/config"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) SendVerificationEmail(email, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.cfg.App.URL, token)

	subject := "Verify your email address"
	body := fmt.Sprintf(
		`<h2>Email Verification</h2>
<p>Please click the link below to verify your email address:</p>
<p><a href="%s">Verify Email</a></p>
<p>This link will expire in 24 hours.</p>
<p>If you didn't create an account, please ignore this email.</p>`,
		verifyURL,
	)

	return s.send(email, subject, body)
}

func (s *EmailService) SendPasswordResetEmail(email, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.cfg.App.URL, token)

	subject := "Reset your password"
	body := fmt.Sprintf(
		`<h2>Password Reset</h2>
<p>Please click the link below to reset your password:</p>
<p><a href="%s">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request a password reset, please ignore this email.</p>`,
		resetURL,
	)

	return s.send(email, subject, body)
}

func (s *EmailService) SendInvitationEmail(email, token, tenantName string) error {
	inviteURL := fmt.Sprintf("%s/invitation/%s", s.cfg.App.URL, token)
	safeName := html.EscapeString(tenantName)

	subject := fmt.Sprintf("You're invited to join %s", tenantName)
	body := fmt.Sprintf(
		`<h2>Invitation</h2>
<p>You've been invited to join <strong>%s</strong>.</p>
<p>Click the link below to accept the invitation and create your account:</p>
<p><a href="%s">Accept Invitation</a></p>
<p>This invitation will expire in 7 days.</p>`,
		safeName, inviteURL,
	)

	return s.send(email, subject, body)
}

func (s *EmailService) send(to, subject, htmlBody string) error {
	m := mail.NewMsg()

	if err := m.From(s.cfg.SMTP.From); err != nil {
		return fmt.Errorf("setting from address: %w", err)
	}
	if err := m.To(to); err != nil {
		return fmt.Errorf("setting to address: %w", err)
	}

	m.Subject(subject)
	m.SetBodyString(mail.TypeTextHTML, htmlBody)

	c, err := mail.NewClient(s.cfg.SMTP.Host,
		mail.WithPort(s.cfg.SMTP.Port),
		mail.WithTLSPolicy(mail.NoTLS),
	)
	if err != nil {
		return fmt.Errorf("creating mail client: %w", err)
	}

	if err := c.DialAndSend(m); err != nil {
		return fmt.Errorf("sending email: %w", err)
	}

	return nil
}
