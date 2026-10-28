import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export type PlaceholderScreenProps = {
  title: string;
  description: string;
  /** Which implementation stage wires this screen to real data. */
  comingInStage: string;
};

/** Stage 1 navigation placeholder. Replaced by real screens in later stages. */
export function PlaceholderScreen({ title, description, comingInStage }: PlaceholderScreenProps) {
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <EmptyState title="Not implemented yet" description={`${description} ${comingInStage}`} />
    </Screen>
  );
}
