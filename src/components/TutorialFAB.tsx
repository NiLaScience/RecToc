import { IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { helpCircleOutline } from 'ionicons/icons';
import { useState } from 'react';
import Tutorial from './Tutorial';

const TutorialFAB: React.FC = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <>
      <IonFab vertical="top" horizontal="start" slot="fixed" style={{ margin: '8px' }}>
        <IonFabButton size="small" color="light" onClick={() => setShowTutorial(true)}>
          <IonIcon icon={helpCircleOutline} />
        </IonFabButton>
      </IonFab>

      <Tutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </>
  );
};

export default TutorialFAB;
