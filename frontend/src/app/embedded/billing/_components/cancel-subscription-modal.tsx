"use client";

import { Modal, TitleBar } from "@shopify/app-bridge-react";
import { BlockStack, Box, Text } from "@shopify/polaris";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  planLabel: string | null | undefined;
  periodEndLabel: string;
  cancelling: boolean;
};

/**
 * Modal de confirmation d'annulation, extraite pour pouvoir l'importer en
 * lazy via next/dynamic depuis la page billing. Évite de pénaliser le LCP de
 * la vue configurator (cas le plus fréquent : merchant sans sub active).
 */
export function CancelSubscriptionModal({
  open,
  onClose,
  onConfirm,
  planLabel,
  periodEndLabel,
  cancelling,
}: Props) {
  return (
    <Modal id="cancel-subscription-modal" open={open} onHide={onClose}>
      <Box padding="500">
        <BlockStack gap="300">
          <Text variant="bodyMd" as="p">
            Voulez-vous vraiment annuler l&apos;abonnement{" "}
            <strong>{planLabel || "actuel"}</strong> ?
          </Text>
          <Text variant="bodyMd" as="p" tone="subdued">
            Vous conserverez l&apos;accès complet jusqu&apos;au{" "}
            <strong>{periodEndLabel}</strong>. Aucun nouveau débit ne sera
            émis. Vous pourrez réactiver un plan à tout moment.
          </Text>
        </BlockStack>
      </Box>
      <TitleBar title="Annuler l'abonnement">
        <button onClick={onClose}>Revenir</button>
        <button
          variant="primary"
          tone="critical"
          loading={cancelling ? "" : undefined}
          onClick={() => void onConfirm()}
        >
          Confirmer l&apos;annulation
        </button>
      </TitleBar>
    </Modal>
  );
}
