package updater

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/sigstore/sigstore-go/pkg/bundle"
	"github.com/sigstore/sigstore-go/pkg/root"
	"github.com/sigstore/sigstore-go/pkg/tuf"
	"github.com/sigstore/sigstore-go/pkg/verify"
)

type SigStoreVerifier struct {
	CertOidcIssuer string
	CertIdentity   string
}

func NewSigStoreVerifier(certOidcIssuer, certIdentity string) *SigStoreVerifier {
	return &SigStoreVerifier{
		CertOidcIssuer: certOidcIssuer,
		CertIdentity:   certIdentity,
	}
}

func (ssv *SigStoreVerifier) Verify(assetPath, bundlePath, version string) error {
	slog.Debug(
		"Verifying asset",
		slog.String("asset", filepath.Base(assetPath)),
		slog.String("version", version),
	)

	trustedRoot, err := root.NewLiveTrustedRoot(tuf.DefaultOptions())
	if err != nil {
		return fmt.Errorf("failed to retrieve trusted root: %w", err)
	}

	sev, err := verify.NewSignedEntityVerifier(
		trustedRoot,
		verify.WithSignedCertificateTimestamps(1),
		verify.WithObserverTimestamps(1),
		verify.WithTransparencyLog(1),
	)
	if err != nil {
		return err
	}

	certID, err := verify.NewShortCertificateIdentity(
		ssv.CertOidcIssuer,
		"",
		ssv.CertIdentity+version,
		"",
	)
	if err != nil {
		return err
	}

	b, err := bundle.LoadJSONFromPath(bundlePath)
	if err != nil {
		return fmt.Errorf("failed loading bundle: %w", err)
	}

	file, err := os.Open(assetPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = sev.Verify(
		b,
		verify.NewPolicy(verify.WithArtifact(file), verify.WithCertificateIdentity(certID)),
	)
	if err != nil {
		return err
	}

	return nil
}
