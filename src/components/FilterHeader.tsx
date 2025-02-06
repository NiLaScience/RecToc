import React from 'react';
import { IonPopover, IonList, IonItem, IonLabel, IonToggle, IonButton } from '@ionic/react';

interface FilterPopoverProps {
  isOpen: boolean;
  onDismiss: () => void;
  showRejected: boolean;
  onToggleRejected: () => void;
  onResetFilters: () => void;
  triggerRef: React.RefObject<HTMLIonButtonElement>;
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  isOpen,
  onDismiss,
  showRejected,
  onToggleRejected,
  onResetFilters,
  triggerRef
}) => {
  return (
    <IonPopover
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      trigger="filter-trigger"
      side="bottom"
      alignment="end"
      arrow={true}
      dismissOnSelect={false}
      className="filter-popover"
    >
      <IonList lines="none">
        <IonItem>
          <IonLabel>Show Rejected Jobs Only</IonLabel>
          <IonToggle
            checked={showRejected}
            onIonChange={onToggleRejected}
            slot="end"
          />
        </IonItem>
        <IonItem lines="none">
          <IonButton
            fill="clear"
            color="medium"
            expand="block"
            onClick={() => {
              onResetFilters();
              onDismiss();
            }}
          >
            Reset Filters
          </IonButton>
        </IonItem>
      </IonList>
    </IonPopover>
  );
};

export default FilterPopover;
