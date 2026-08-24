import { Section, Text as SwiftUIText } from '@expo/ui/swift-ui';
import { useTranslation } from 'react-i18next';

import { IosSheetForm, IosSheetPage } from '@/components/ui';
import { useSettingsStore } from '@/features/settings';
import { HeaderCircleButton, SettingsNavRow } from './common';

export function LanServersPage({
  onBack,
  onAdd,
  onEdit,
  embedded = false,
}: {
  onBack(): void;
  onAdd(): void;
  onEdit(serverId: string): void;
  embedded?: boolean;
}) {
  const { t } = useTranslation('settingsSync');
  const servers = useSettingsStore((state) => state.config?.lanServers ?? []);

  const content = (
    <Section footer={<SwiftUIText>{t('lan.notAvailableYet')}</SwiftUIText>}>
      {servers.length === 0 ? (
        <SettingsNavRow
          icon="plus.circle"
          title={t('lan.add')}
          showsChevron={false}
          onPress={onAdd}
        />
      ) : (
        servers.map((server) => (
          <SettingsNavRow
            key={server.id}
            title={server.name || server.urls[0]}
            onPress={() => onEdit(server.id)}
          />
        ))
      )}
    </Section>
  );

  if (embedded) return content;

  return (
    <IosSheetPage
      title={t('lan.title')}
      leftSlots={[<HeaderCircleButton key="back" systemName="chevron.left" onPress={onBack} />]}
      rightSlots={[<HeaderCircleButton key="add" systemName="plus" onPress={onAdd} />]}
    >
      <IosSheetForm>{content}</IosSheetForm>
    </IosSheetPage>
  );
}
