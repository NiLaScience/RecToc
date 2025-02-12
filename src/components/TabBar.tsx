'use client';

import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { homeOutline, addCircleOutline, personOutline, cloudUploadOutline, documentTextOutline } from 'ionicons/icons';
import { Route, Redirect, useLocation } from 'react-router-dom';
import { IonReactRouter } from '@ionic/react-router';
import Feed from './Feed';
import Upload from './Upload';
import Profile from './Profile';
import Applications from './Applications';

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
          <Route exact path="/applications" component={Applications} />
          <Route exact path="/profile" component={Profile} />
          <Route exact path="/settings">
            <Redirect to="/profile" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="feed" href="/" selected={path === '/'}>
            <IonIcon icon={homeOutline} />
            <IonLabel>Job Feed</IonLabel>
          </IonTabButton>
          <IonTabButton tab="upload" href="/upload" selected={path === '/upload'}>
            <IonIcon icon={cloudUploadOutline} />
            <IonLabel>Upload Job</IonLabel>
          </IonTabButton>
          <IonTabButton tab="applications" href="/applications" selected={path === '/applications'}>
            <IonIcon icon={documentTextOutline} />
            <IonLabel>Applications</IonLabel>
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