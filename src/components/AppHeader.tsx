import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { notificationsOutline, gridOutline, closeOutline } from 'ionicons/icons';

interface AppHeaderProps {
  title: string;
  mode?: 'grid' | 'feed' | 'fullscreen' | 'details' | 'upload' | 'apply';
  showFeedButtons?: boolean;
  onClose?: () => void;
  onToggleView?: () => void;
  onNotifications?: () => void;
  rightContent?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  mode = 'feed',
  showFeedButtons = false,
  onClose,
  onToggleView,
  onNotifications,
  rightContent,
}) => {
  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#000',
  };

  return (
    <>
      <IonHeader style={headerStyle}>
        <IonToolbar className="dark-toolbar">
          <IonTitle style={{ color: '#fff' }}>{title}</IonTitle>
          {(showFeedButtons || onClose || rightContent) && (
            <IonButtons slot="end">
              {showFeedButtons ? (
                <>
                  {onToggleView && (
                    <IonButton 
                      onClick={onToggleView}
                      style={{ color: '#fff' }}
                    >
                      <IonIcon icon={gridOutline} />
                    </IonButton>
                  )}
                  {onNotifications && (
                    <IonButton 
                      onClick={onNotifications}
                      style={{ color: '#fff' }}
                    >
                      <IonIcon icon={notificationsOutline} />
                    </IonButton>
                  )}
                </>
              ) : onClose ? (
                <IonButton 
                  onClick={onClose}
                  style={{ color: '#fff' }}
                >
                  <IonIcon icon={closeOutline} />
                </IonButton>
              ) : null}
              {rightContent}
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <style>{`
        .dark-toolbar {
          --background: #000;
          --color: #fff;
          --ion-color-primary: #fff;
          --ion-toolbar-background: #000;
        }
        ion-content {
          --padding-top: 56px;
        }
      `}</style>
    </>
  );
};

export default AppHeader; 