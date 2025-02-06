'use client';

import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { homeOutline, addCircleOutline, personOutline } from 'ionicons/icons';
import { Route, Redirect, useLocation } from 'react-router-dom';
import { IonReactRouter } from '@ionic/react-router';
import Feed from './Feed';
import Upload from './Upload';
import Profile from './Profile';

const TabBarContent = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <>
      <style>{`
        ion-tab-bar {
          --background: #000;
        }
        ion-tab-button {
          --color: #666;
          --color-selected: #fff;
        }
      `}</style>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/" component={Feed} />
          <Route exact path="/upload" component={Upload} />
          <Route exact path="/profile" component={Profile} />
          <Route exact path="/settings">
            <Redirect to="/profile" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="feed" href="/" selected={path === '/'}>
            <IonIcon icon={homeOutline} />
            <IonLabel>Feed</IonLabel>
          </IonTabButton>
          <IonTabButton tab="upload" href="/upload" selected={path === '/upload'}>
            <IonIcon icon={addCircleOutline} />
            <IonLabel>Upload</IonLabel>
          </IonTabButton>
          <IonTabButton tab="profile" href="/profile" selected={path === '/profile'}>
            <IonIcon icon={personOutline} />
            <IonLabel>Profile</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </>
  );
};

const TabBar = () => {
  return (
    <IonReactRouter>
      <TabBarContent />
    </IonReactRouter>
  );
};

export default TabBar; 