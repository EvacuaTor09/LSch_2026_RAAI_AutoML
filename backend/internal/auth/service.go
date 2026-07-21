package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type User struct {
	Username     string
	PasswordHash string
}

type Store interface {
	GetUser(ctx context.Context, username string) (User, error)
	UpsertUser(ctx context.Context, user User) error
}

type Service struct {
	store    Store
	secret   []byte
	tokenTTL time.Duration
}

type Claims struct {
	Username string `json:"username"`
	Subject  string `json:"sub"`
	IssuedAt int64  `json:"iat"`
	ExpiresAt int64 `json:"exp"`
}

type contextKey string

const usernameContextKey contextKey = "username"

func NewService(store Store, secret string, tokenTTL time.Duration) *Service {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}
	return &Service{
		store:    store,
		secret:   []byte(secret),
		tokenTTL: tokenTTL,
	}
}

func (s *Service) BootstrapUser(ctx context.Context, username, password string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil
	}
	password = strings.TrimSpace(password)
	if password == "" {
		return fmt.Errorf("bootstrap password is required for %s", username)
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	return s.store.UpsertUser(ctx, User{Username: username, PasswordHash: string(hash)})
}

func (s *Service) Register(ctx context.Context, username, password string) (string, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	if username == "" || password == "" {
		return "", fmt.Errorf("username and password are required")
	}
	if _, err := s.store.GetUser(ctx, username); err == nil {
		return "", fmt.Errorf("user already exists")
	} else if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return "", err
	}
	if err := s.store.UpsertUser(ctx, User{Username: username, PasswordHash: string(hash)}); err != nil {
		return "", err
	}
	return s.Login(ctx, username, password)
}

func (s *Service) Login(ctx context.Context, username, password string) (string, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	if username == "" || password == "" {
		return "", fmt.Errorf("username and password are required")
	}

	user, err := s.store.GetUser(ctx, username)
	if err != nil {
		return "", err
	}
	if !verifyPassword(password, user.PasswordHash) {
		return "", fmt.Errorf("invalid username or password")
	}

	now := time.Now().UTC()
	return s.signToken(Claims{
		Username:  username,
		Subject:   username,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(s.tokenTTL).Unix(),
	})
}

func (s *Service) UsernameFromRequest(req *http.Request) (string, error) {
	authorization := strings.TrimSpace(req.Header.Get("Authorization"))
	if authorization == "" {
		return "", fmt.Errorf("missing authorization header")
	}
	parts := strings.SplitN(authorization, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(strings.TrimSpace(parts[0]), "Bearer") {
		return "", fmt.Errorf("invalid authorization header")
	}
	return s.UsernameFromToken(parts[1])
}

func (s *Service) UsernameFromToken(tokenString string) (string, error) {
	claims, err := s.parseToken(tokenString)
	if err != nil {
		return "", err
	}
	if claims.Username == "" {
		return "", errors.New("token does not include a username")
	}
	if claims.ExpiresAt > 0 && time.Now().UTC().Unix() > claims.ExpiresAt {
		return "", errors.New("token expired")
	}
	return claims.Username, nil
}

func WithUsername(ctx context.Context, username string) context.Context {
	return context.WithValue(ctx, usernameContextKey, username)
}

func UsernameFromContext(ctx context.Context) (string, bool) {
	value, ok := ctx.Value(usernameContextKey).(string)
	return value, ok && value != ""
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, salt)
	mac.Write([]byte(password))
	return hex.EncodeToString(salt) + ":" + hex.EncodeToString(mac.Sum(nil)), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, ":")
	if len(parts) != 2 {
		return false
	}
	salt, err := hex.DecodeString(parts[0])
	if err != nil {
		return false
	}
	expected, err := hex.DecodeString(parts[1])
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, salt)
	mac.Write([]byte(password))
	return hmac.Equal(expected, mac.Sum(nil))
}

func (s *Service) signToken(claims Claims) (string, error) {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	headerPart := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadPart := base64.RawURLEncoding.EncodeToString(payloadJSON)
	signingInput := headerPart + "." + payloadPart
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(signingInput))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return signingInput + "." + signature, nil
}

func (s *Service) parseToken(tokenString string) (Claims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return Claims{}, fmt.Errorf("invalid token")
	}
	signingInput := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Claims{}, fmt.Errorf("invalid token signature")
	}
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(signingInput))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return Claims{}, errors.New("invalid token signature")
	}
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, fmt.Errorf("invalid token payload")
	}
	var claims Claims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return Claims{}, err
	}
	return claims, nil
}