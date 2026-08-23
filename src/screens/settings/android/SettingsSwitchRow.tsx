import { ListItem, Switch as ComposeSwitch, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { toggleable } from '@expo/ui/jetpack-compose/modifiers';

interface SettingsSwitchRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SettingsSwitchRow({
  title,
  description,
  value,
  onValueChange,
}: SettingsSwitchRowProps) {
  return (
    <ListItem modifiers={[toggleable(value, () => onValueChange(!value), { role: 'switch' })]}>
      <ListItem.HeadlineContent>
        <ComposeText>{title}</ComposeText>
      </ListItem.HeadlineContent>
      {description ? (
        <ListItem.SupportingContent>
          <ComposeText>{description}</ComposeText>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        <ComposeSwitch value={value} onCheckedChange={undefined} />
      </ListItem.TrailingContent>
    </ListItem>
  );
}
