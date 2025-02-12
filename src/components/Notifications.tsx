import { 
  IonModal, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonButtons,
  IonButton,
  IonIcon 
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';

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
          <IonButtons slot="end">
            <IonButton onClick={onDidDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem>
            <IonLabel>
              <h2>Welcome to Nexus!</h2>
              <p>Start exploring videos now.</p>
            </IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonModal>
  );
};

export default Notifications;