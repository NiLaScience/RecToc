import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonLabel,
} from '@ionic/react';
import type { JobDescription } from '../../types/job_opening';
import AccordionGroup from './AccordionGroup';
import AccordionSection from './AccordionSection';
import { ListContent, ChipsContent } from './AccordionContent';
import { formatTime } from '../../utils/time';
import { Transcript } from '../../types/job_opening';

interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface Salary {
  min: number;
  max: number;
  currency: string;
  period: string;
}

interface JobDescriptionAccordionProps extends Partial<JobDescription> {
  showCard?: boolean;
}

export const JobDescriptionAccordion: React.FC<JobDescriptionAccordionProps> = (props) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const { showCard = true } = props;

  const handleAccordionChange = (section: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(section)) {
      newOpenSections.delete(section);
    } else {
      newOpenSections.add(section);
    }
    setOpenSections(newOpenSections);
  };

  const renderList = (items: string[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <ul style={{ 
        listStyle: 'none', 
        padding: 0, 
        margin: 0 
      }}>
        {items.map((item, index) => (
          <li 
            key={index}
            style={{ 
              marginBottom: '0.75rem',
              paddingLeft: '1.5rem',
              position: 'relative',
              lineHeight: '1.4'
            }}
          >
            <span style={{
              position: 'absolute',
              left: 0,
              color: '#0055ff'
            }}>•</span>
            {item}
          </li>
        ))}
      </ul>
    );
  };

  const renderSalary = (salary: JobDescription['salary']) => {
    if (!salary) return null;
    const { min, max, currency, period } = salary;
    return (
      <p style={{ margin: '0.5rem 0' }}>
        {currency}{min.toLocaleString()} - {currency}{max.toLocaleString()} per {period}
      </p>
    );
  };

  const renderChips = (items: string[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
        {items.map((item, index) => (
          <IonChip 
            key={index}
            style={{ 
              '--background': '#333',
              '--color': '#fff',
              margin: 0
            }}
          >
            <IonLabel>{item}</IonLabel>
          </IonChip>
        ))}
      </div>
    );
  };

  const accordionContent = (
    <AccordionGroup value={Array.from(openSections).join(',')}>
      {props.responsibilities && props.responsibilities.length > 0 && (
        <AccordionSection
          value="responsibilities"
          label="Responsibilities"
          onClick={() => handleAccordionChange('responsibilities')}
        >
          {renderList(props.responsibilities)}
        </AccordionSection>
      )}

      {props.requirements && props.requirements.length > 0 && (
        <AccordionSection
          value="requirements"
          label="Requirements"
          onClick={() => handleAccordionChange('requirements')}
        >
          {renderList(props.requirements)}
        </AccordionSection>
      )}

      {props.skills && props.skills.length > 0 && (
        <AccordionSection
          value="skills"
          label="Skills"
          onClick={() => handleAccordionChange('skills')}
        >
          {renderChips(props.skills)}
        </AccordionSection>
      )}

      {props.benefits && props.benefits.length > 0 && (
        <AccordionSection
          value="benefits"
          label="Benefits"
          onClick={() => handleAccordionChange('benefits')}
        >
          {renderList(props.benefits)}
        </AccordionSection>
      )}

      {props.salary && (
        <AccordionSection
          value="salary"
          label="Salary"
          onClick={() => handleAccordionChange('salary')}
        >
          {renderSalary(props.salary)}
        </AccordionSection>
      )}
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
        <IonCardTitle style={{ color: '#fff' }}>{props.title}</IonCardTitle>
        {(props.company || props.location) && (
          <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {props.company}
            {props.location && (props.company ? ` • ${props.location}` : props.location)}
          </IonCardSubtitle>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {props.employmentType && (
            <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
              {props.employmentType}
            </IonChip>
          )}
          {props.experienceLevel && (
            <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
              {props.experienceLevel}
            </IonChip>
          )}
        </div>
      </IonCardHeader>
      <IonCardContent>
        {accordionContent}
      </IonCardContent>
    </IonCard>
  );
};

export default JobDescriptionAccordion; 