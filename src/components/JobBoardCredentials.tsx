import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonAlert,
  useIonToast,
  IonSpinner,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';

interface PlatformCredentials {
  username: string;
  password: string;
}

interface JobBoardCredentials {
  [platform: string]: PlatformCredentials;
}

const STORAGE_KEY = 'job_board_credentials';

// Supported platforms - can be extended as needed
const SUPPORTED_PLATFORMS = [
  'linkedin',
  'indeed',
  'glassdoor',
  'ziprecruiter',
  'monster',
  'workday',
  'greenhouse',
  'lever'
];

const JobBoardCredentials: React.FC = () => {
  const [credentials, setCredentials] = useState<JobBoardCredentials>({});
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState<string | null>(null);
  const [newCredential, setNewCredential] = useState<{platform: string, username: string, password: string}>({
    platform: '',
    username: '',
    password: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [presentToast] = useIonToast();

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        setCredentials(JSON.parse(value));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading credentials:', error);
      presentToast({
        message: 'Error loading credentials',
        duration: 3000,
        color: 'danger',
      });
      setLoading(false);
    }
  };

  const saveCredentials = async (updatedCredentials: JobBoardCredentials) => {
    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(updatedCredentials),
      });
      setCredentials(updatedCredentials);
      presentToast({
        message: 'Credentials saved successfully',
        duration: 2000,
        color: 'success',
      });
    } catch (error) {
      console.error('Error saving credentials:', error);
      presentToast({
        message: 'Error saving credentials',
        duration: 3000,
        color: 'danger',
      });
    }
  };

  const handleAddCredential = async () => {
    if (!newCredential.platform || !newCredential.username || !newCredential.password) {
      presentToast({
        message: 'Please fill in all fields',
        duration: 3000,
        color: 'warning',
      });
      return;
    }

    const updatedCredentials = {
      ...credentials,
      [newCredential.platform.toLowerCase()]: {
        username: newCredential.username,
        password: newCredential.password,
      }
    };

    await saveCredentials(updatedCredentials);
    setNewCredential({ platform: '', username: '', password: '' });
    setShowAddForm(false);
  };

  const handleDeleteCredential = async (platform: string) => {
    const updatedCredentials = { ...credentials };
    delete updatedCredentials[platform];
    await saveCredentials(updatedCredentials);
    setShowDeleteAlert(null);
  };

  if (loading) {
    return (
      <div className="ion-padding ion-text-center">
        <IonSpinner />
      </div>
    );
  }

  return (
    <div className="ion-padding">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Job Board Credentials</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonList>
          {Object.entries(credentials).map(([platform, cred]) => (
            <IonItem key={platform}>
              <IonLabel>
                <h2 style={{ textTransform: 'capitalize' }}>{platform}</h2>
                <p>{cred.username}</p>
              </IonLabel>
              <IonButton
                fill="clear"
                slot="end"
                onClick={() => setShowDeleteAlert(platform)}
              >
                <IonIcon icon={trashOutline} slot="icon-only" />
              </IonButton>
            </IonItem>
          ))}
        </IonList>

        {showAddForm ? (
          <div className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Platform</IonLabel>
              <IonSelect
                value={newCredential.platform}
                onIonChange={e => setNewCredential(prev => ({ ...prev, platform: e.detail.value }))}
                placeholder="Select Platform"
              >
                {SUPPORTED_PLATFORMS.map(platform => (
                  <IonSelectOption 
                    key={platform} 
                    value={platform}
                    disabled={platform in credentials}
                  >
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Username</IonLabel>
              <IonInput
                value={newCredential.username}
                onIonChange={e => setNewCredential(prev => ({ ...prev, username: e.detail.value! }))}
                placeholder="Email or username"
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                value={newCredential.password}
                onIonChange={e => setNewCredential(prev => ({ ...prev, password: e.detail.value! }))}
                placeholder="Password"
              />
            </IonItem>
            <div className="ion-padding-top">
              <IonButton expand="block" onClick={handleAddCredential}>
                Save Credential
              </IonButton>
              <IonButton expand="block" fill="clear" onClick={() => {
                setShowAddForm(false);
                setNewCredential({ platform: '', username: '', password: '' });
              }}>
                Cancel
              </IonButton>
            </div>
          </div>
        ) : (
          <div className="ion-padding">
            <IonButton expand="block" onClick={() => setShowAddForm(true)}>
              <IonIcon icon={addOutline} slot="start" />
              Add New Credential
            </IonButton>
          </div>
        )}

        <IonAlert
          isOpen={!!showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(null)}
          header="Delete Credential"
          message="Are you sure you want to delete this credential?"
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: () => {
                if (showDeleteAlert) {
                  handleDeleteCredential(showDeleteAlert);
                }
              },
            },
          ]}
        />
      </IonContent>
    </div>
  );
};

export default JobBoardCredentials; 