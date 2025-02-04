'use client';

import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { homeOutline, listOutline, settingsOutline } from 'ionicons/icons';
import { Route, Redirect } from 'react-router-dom';
import { IonReactRouter } from '@ionic/react-router';
import Feed from './Feed';
import List from './List';
import Settings from './Settings';

const TabBar = () => {
  return (
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/feed" component={Feed} />
          <Route exact path="/list" component={List} />
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
          <IonTabButton tab="list" href="/list">
            <IonIcon icon={listOutline} />
            <IonLabel>List</IonLabel>
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