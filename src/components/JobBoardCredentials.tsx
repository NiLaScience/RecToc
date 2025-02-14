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
  IonModal,
  IonButtons,
} from '@ionic/react';
import { addOutline, trashOutline, closeOutline, pencilOutline, checkmarkOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';

interface PlatformCredentials {
  username: string;
  password: string;
}

interface JobBoardCredentials {
  [platform: string]: PlatformCredentials;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
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

const JobBoardCredentials: React.FC<Props> = ({ isOpen, onClose }) => {
  const [credentials, setCredentials] = useState<JobBoardCredentials>({});
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState<string | null>(null);
  const [newCredential, setNewCredential] = useState<{platform: string, username: string, password: string}>({
    platform: '',
    username: '',
    password: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editCredential, setEditCredential] = useState<PlatformCredentials>({ username: '', password: '' });
  const [presentToast] = useIonToast();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

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

  const handleStartEdit = (platform: string) => {
    setEditingPlatform(platform);
    setEditCredential({ ...credentials[platform] });
  };

  const handleSaveEdit = async () => {
    if (!editingPlatform || !editCredential.username || !editCredential.password) {
      presentToast({
        message: 'Please fill in all fields',
        duration: 3000,
        color: 'warning',
      });
      return;
    }

    const updatedCredentials = {
      ...credentials,
      [editingPlatform]: editCredential
    };

    await saveCredentials(updatedCredentials);
    setEditingPlatform(null);
    setEditCredential({ username: '', password: '' });
    setShowEditPassword(false);
  };

  const handleClose = () => {
    setShowAddForm(false);
    setNewCredential({ platform: '', username: '', password: '' });
    setEditingPlatform(null);
    setEditCredential({ username: '', password: '' });
    setShowNewPassword(false);
    setShowEditPassword(false);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Job Board Credentials</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div className="ion-padding ion-text-center">
            <IonSpinner />
          </div>
        ) : (
          <div className="ion-padding">
            <p className="ion-padding-bottom">
              Add your login credentials for various job boards. These will be used by the AI agent to apply on your behalf.
            </p>

            <IonList>
              {Object.entries(credentials).map(([platform, cred]) => (
                <IonItem key={platform}>
                  {editingPlatform === platform ? (
                    // Edit mode
                    <div style={{ width: '100%' }}>
                      <IonInput
                        value={editCredential.username}
                        onIonInput={e => setEditCredential(prev => ({ ...prev, username: e.detail.value! }))}
                        placeholder="Username"
                        className="ion-margin-bottom"
                      />
                      <IonInput
                        type={showEditPassword ? 'text' : 'password'}
                        value={editCredential.password}
                        onIonInput={e => setEditCredential(prev => ({ ...prev, password: e.detail.value! }))}
                        placeholder="Password"
                        className="ion-margin-bottom"
                      >
                        <IonButton
                          fill="clear"
                          slot="end"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          style={{ margin: 0 }}
                        >
                          <IonIcon icon={showEditPassword ? eyeOffOutline : eyeOutline} style={{ color: '#666' }} />
                        </IonButton>
                      </IonInput>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <IonButton
                          fill="clear"
                          onClick={() => {
                            setEditingPlatform(null);
                            setEditCredential({ username: '', password: '' });
                            setShowEditPassword(false);
                          }}
                        >
                          Cancel
                        </IonButton>
                        <IonButton onClick={handleSaveEdit}>
                          <IonIcon icon={checkmarkOutline} slot="start" />
                          Save
                        </IonButton>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <IonLabel>
                        <h2 style={{ textTransform: 'capitalize' }}>{platform}</h2>
                        <p>{cred.username}</p>
                      </IonLabel>
                      <IonButton
                        fill="clear"
                        slot="end"
                        onClick={() => handleStartEdit(platform)}
                      >
                        <IonIcon icon={pencilOutline} slot="icon-only" />
                      </IonButton>
                      <IonButton
                        fill="clear"
                        slot="end"
                        onClick={() => setShowDeleteAlert(platform)}
                      >
                        <IonIcon icon={trashOutline} slot="icon-only" />
                      </IonButton>
                    </>
                  )}
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
                    onIonInput={e => setNewCredential(prev => ({ ...prev, username: e.detail.value! }))}
                    placeholder="Email or username"
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Password</IonLabel>
                  <IonInput
                    type={showNewPassword ? 'text' : 'password'}
                    value={newCredential.password}
                    onIonInput={e => setNewCredential(prev => ({ ...prev, password: e.detail.value! }))}
                    placeholder="Password"
                  >
                    <IonButton
                      fill="clear"
                      slot="end"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ margin: 0 }}
                    >
                      <IonIcon icon={showNewPassword ? eyeOffOutline : eyeOutline} style={{ color: '#666' }} />
                    </IonButton>
                  </IonInput>
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
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default JobBoardCredentials; 