'use client';

import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { homeOutline, addOutline, settingsOutline } from 'ionicons/icons';
import { Route, Redirect } from 'react-router-dom';
import { IonReactRouter } from '@ionic/react-router';
import Feed from './Feed';
import Upload from './Upload';
import Settings from './Settings';

const TabBar = () => {
  return (
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/feed" component={Feed} />
          <Route exact path="/upload" component={Upload} />
          <Route exact path="/settings" component={Settings} />
          <Route exact path="/">
            <Redirect to="/feed" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="feed" href="/feed">
            <IonIcon icon={homeOutline} />
            <IonLabel>Feed</IonLabel>
          </IonTabButton>
          <IonTabButton tab="upload" href="/upload">
            <IonIcon icon={addOutline} />
            <IonLabel>Upload</IonLabel>
          </IonTabButton>
          <IonTabButton tab="settings" href="/settings">
            <IonIcon icon={settingsOutline} />
            <IonLabel>Settings</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  );
};

export default TabBar; 