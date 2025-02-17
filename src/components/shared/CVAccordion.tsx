import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/react';
import AccordionGroup from './AccordionGroup';
import AccordionSection from './AccordionSection';
import { ExperienceContent, EducationContent, ChipsContent } from './AccordionContent';
import type { CVSchema } from '../../types/user';

interface CVAccordionProps extends Partial<CVSchema> {
  displayName?: string;
  showCard?: boolean;
}

export const CVAccordion: React.FC<CVAccordionProps> = (props) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const { displayName, personalInfo, showCard = true } = props;

  const handleAccordionChange = (section: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(section)) {
      newOpenSections.delete(section);
    } else {
      newOpenSections.add(section);
    }
    setOpenSections(newOpenSections);
  };

  const formatSectionTitle = (key: string): string => {
    // Skip displayName from being rendered as a section
    if (key === 'displayName') return '';
    
    // Add space before capital letters and capitalize first letter
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const renderSectionContent = (key: string, value: unknown): React.ReactNode => {
    if (!value || typeof value === 'boolean') return null;

    if (key === 'personalInfo') {
      const info = value as CVSchema['personalInfo'];
      return (
        <div>
          {info.name && <p><strong>Name:</strong> {info.name}</p>}
          {info.email && <p><strong>Email:</strong> {info.email}</p>}
          {info.phone && <p><strong>Phone:</strong> {info.phone}</p>}
          {info.location && <p><strong>Location:</strong> {info.location}</p>}
          {info.summary && <p style={{ marginTop: '1rem' }}>{info.summary}</p>}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div>
          {value.map((item, index) => {
            if (typeof item === 'string') {
              return <p key={index}>{item}</p>;
            }
            
            if (typeof item === 'object' && item !== null) {
              return (
                <div key={index} style={{ marginBottom: '1rem' }}>
                  {Object.entries(item).map(([itemKey, itemValue]) => {
                    if (itemValue && typeof itemValue !== 'boolean') {
                      return (
                        <p key={itemKey}>
                          <strong>{itemKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong>{' '}
                          {Array.isArray(itemValue) ? itemValue.join(', ') : itemValue.toString()}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div>
          {Object.entries(value).map(([key, val]) => {
            if (val && typeof val !== 'boolean') {
              return (
                <p key={key}>
                  <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong>{' '}
                  {Array.isArray(val) ? val.join(', ') : val.toString()}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }

    return <p>{value.toString()}</p>;
  };

  const accordionContent = (
    <AccordionGroup value={Array.from(openSections).join(',')}>
      {Object.entries(props).map(([key, value]) => {
        const title = formatSectionTitle(key);
        if (!title) return null;

        const content = renderSectionContent(key, value);
        if (!content) return null;

        return (
          <AccordionSection
            key={key}
            value={key}
            label={title}
            onClick={() => handleAccordionChange(key)}
          >
            {content}
          </AccordionSection>
        );
      })}
    </AccordionGroup>
  );

  if (!showCard) {
    return accordionContent;
  }

  return (
    <IonCard style={{ 
      '--background': '#2a2a2a',
      '--color': '#fff',
      margin: 0,
      borderRadius: '8px',
      border: '2px solid rgba(255, 255, 255, 0.1)'
    }}>
      <IonCardHeader>
        <IonCardTitle>Resume</IonCardTitle>
        {(displayName || personalInfo?.location) && (
          <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {displayName}
            {personalInfo?.location && (displayName ? ` • ${personalInfo.location}` : personalInfo.location)}
          </IonCardSubtitle>
        )}
      </IonCardHeader>
      <IonCardContent>
        {personalInfo && (
          <div style={{ marginBottom: '1.5rem' }}>
            {personalInfo.summary && (
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '1rem',
                lineHeight: '1.5',
                margin: 0
              }}>
                {personalInfo.summary}
              </p>
            )}
          </div>
        )}
        {accordionContent}
      </IonCardContent>
    </IonCard>
  );
};

export default CVAccordion; 