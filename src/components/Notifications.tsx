import { IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel } from '@ionic/react';

interface NotificationsProps {
  open: boolean;
  onDidDismiss: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ open, onDidDismiss }) => {
  return (
    <IonModal isOpen={open} onDidDismiss={onDidDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Notifications</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem>
            <IonLabel>
              <h2>Welcome to ReCToC!</h2>
              <p>Start exploring videos now.</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );
};

export default Notifications; 