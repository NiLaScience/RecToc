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
      title: 'Welcome to ReCToC',
      description: 'Your personalized video job application platform. Let\'s get you started!',
      icon: playCircleOutline,
      color: 'primary'
    },
    {
      title: 'Browse Job Listings',
      description: 'Scroll through our curated list of video job postings. Each posting includes detailed information about the role.',
      icon: searchOutline,
      color: 'secondary'
    },
    {
      title: 'Record Your Response',
      description: 'Create personalized video responses to job postings. Show your personality and skills in action!',
      icon: videocamOutline,
      color: 'tertiary'
    },
    {
      title: 'Track Applications',
      description: 'Keep track of all your applications and their status in one place.',
      icon: documentTextOutline,
      color: 'success'
    },
    {
      title: 'Ready to Start!',
      description: 'You\'re all set to begin your video job application journey.',
      icon: rocketOutline,
      color: 'primary'
    }
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
                <h2>{step.title}</h2>
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
