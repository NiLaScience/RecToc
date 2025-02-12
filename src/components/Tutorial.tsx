import {
  IonModal,
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonText,
} from '@ionic/react';
import {
  closeOutline,
  arrowForward,
  checkmarkCircle,
  playCircleOutline,
  searchOutline,
  videocamOutline,
  documentTextOutline,
  rocketOutline,
  gridOutline,
  personOutline,
  notificationsOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import { useState } from 'react';
// Import Swiper and modules
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [showSkip, setShowSkip] = useState(true);

  const tutorialSteps = [
    {
      title: 'Welcome to Nexus',
      description:
        'We are a personalized video job application platform. With Nexus, you can browse, watch, and apply to job listings through short videos. Let\'s get started!',
      icon: rocketOutline,
      color: 'primary',
    },
    {
      title: 'Two Feed Views',
      description:
        'Use the grid view for quick scanning or switch to fullscreen mode for a TikTok-like swiping experience. Toggle between these modes with the grid icon in the header.',
      icon: gridOutline,
      color: 'secondary',
    },
    {
      title: 'Swipe Gestures',
      description:
        'In fullscreen mode, swipe up or down to move between videos, swipe left to reject a job, or swipe right to open details. In the details view, swipe left to close.',
      icon: arrowForward,
      color: 'tertiary',
    },
    {
      title: 'Reject and Filter',
      description:
        'Left swiping rejects a video. You can also use the filter icon in the header to show or hide rejected videos at any time.',
      icon: closeOutline,
      color: 'danger',
    },
    {
      title: 'View Job Details',
      description:
        'Tap or swipe right on a video to see more info about the job, including descriptions and an option to apply.',
      icon: documentTextOutline,
      color: 'success',
    },
    {
      title: 'Apply with Video',
      description:
        'Record or upload your video response directly in the app. Use our integrated application modal to submit quickly.',
      icon: videocamOutline,
      color: 'warning',
    },
    {
      title: 'Profile & CV',
      description:
        'In the Profile tab, you can manage your account info, upload or parse your CV, and update your personal details.',
      icon: personOutline,
      color: 'tertiary',
    },
    {
      title: 'Notifications & Subtitles',
      description:
        'In fullscreen playback, tap the volume or CC button for audio and subtitles control.',
      icon: playCircleOutline,
      color: 'primary',
    },
    {
      title: 'Revisit Tutorial',
      description:
        'You can reopen this guide anytime by tapping the help button in the top-left corner. Enjoy exploring Nexus!',
      icon: helpCircleOutline,
      color: 'medium',
    },
  ];

  const handleSlideChange = (swiper: any) => {
    setShowSkip(swiper.activeIndex !== tutorialSteps.length - 1);
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="tutorial-modal"
    >
      <IonContent scrollY={false} className="ion-padding">
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="end">
              {showSkip ? (
                <IonButton onClick={onClose}>Skip</IonButton>
              ) : (
                <IonButton onClick={onClose}>
                  <IonIcon icon={checkmarkCircle} slot="start" />
                  Done
                </IonButton>
              )}
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true }}
          onSlideChange={handleSlideChange}
          className="tutorial-swiper"
          direction="horizontal"
        >
          {tutorialSteps.map((step, index) => (
            <SwiperSlide key={index}>
              <div className="slide-content">
                <div className="icon-container">
                  <IonIcon
                    icon={step.icon}
                    color={step.color}
                    className="slide-icon"
                  />
                </div>
                <h2 style={{ color: '#fff' }}>{step.title}</h2>
                <IonText color="medium">
                  <p>{step.description}</p>
                </IonText>
                {index < tutorialSteps.length - 1 && (
                  <IonButton fill="clear">
                    Swipe to continue
                    <IonIcon slot="end" icon={arrowForward} />
                  </IonButton>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </IonContent>
    </IonModal>
  );
};

export default Tutorial;
