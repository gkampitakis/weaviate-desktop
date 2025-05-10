package encrypter

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/denisbrodbeck/machineid"
)

// for testing
var getMachineID = machineid.ID

type Encrypter struct {
	cipher cipher.Block
}

func New() *Encrypter {
	id, err := getMachineID()
	if err != nil {
		slog.Warn("failed to get machine ID", "error", err)
		// noop encrypter
		return &Encrypter{}
	}

	block, err := aes.NewCipher([]byte(id[:32]))
	if err != nil {
		slog.Warn("failed to get machine ID", "error", err)
		// noop encrypter
		return &Encrypter{}
	}

	return &Encrypter{
		cipher: block,
	}
}

// Encrypt encrypts plaintext using AES-256-GCM.
// Returns base64-encoded ciphertext.
func (e *Encrypter) Encrypt(data string) (string, error) {
	if e.cipher == nil {
		return data, nil
	}

	gcm, err := cipher.NewGCM(e.cipher)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(data), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext using AES-256-GCM.
// Returns the original plaintext.
func (e *Encrypter) Decrypt(encrypted string) (string, error) {
	if e.cipher == nil {
		return encrypted, nil
	}

	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(e.cipher)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (e *Encrypter) DecryptSecret(encrypted string) (string, error) {
	decrypted, err := e.Decrypt(encrypted)
	if err != nil {
		return "", err
	}

	return decrypted[:3] + strings.Repeat("*", len(decrypted)-3), nil
}
