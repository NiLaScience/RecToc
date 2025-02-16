import React from 'react';
import { IonList, IonItem, IonLabel } from '@ionic/react';
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

interface JobDescriptionAccordionProps {
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  benefits?: string[];
  salary?: Salary;
  transcript?: Transcript | null;
}

const JobDescriptionAccordion: React.FC<JobDescriptionAccordionProps> = ({
  responsibilities,
  requirements,
  skills,
  benefits,
  salary,
  transcript
}) => {
  return (
    <AccordionGroup>
      {responsibilities && responsibilities.length > 0 && (
        <AccordionSection value="responsibilities" label="Responsibilities">
          <ListContent items={responsibilities} />
        </AccordionSection>
      )}
      
      {requirements && requirements.length > 0 && (
        <AccordionSection value="requirements" label="Requirements">
          <ListContent items={requirements} />
        </AccordionSection>
      )}
      
      {skills && skills.length > 0 && (
        <AccordionSection value="skills" label="Required Skills">
          <ChipsContent items={skills} />
        </AccordionSection>
      )}

      {benefits && benefits.length > 0 && (
        <AccordionSection value="benefits" label="Benefits">
          <ListContent items={benefits} />
        </AccordionSection>
      )}

      {salary && (
        <AccordionSection value="salary" label="Salary">
          <p style={{ color: '#fff' }}>
            {salary.min}-{salary.max} {salary.currency} ({salary.period})
          </p>
        </AccordionSection>
      )}

      {transcript && transcript.segments.length > 0 && (
        <AccordionSection value="transcript" label="Video Transcript">
          <IonList style={{ background: 'transparent' }}>
            {transcript.segments.map((segment) => (
              <IonItem 
                key={segment.id} 
                lines="none"
                style={{ 
                  '--background': 'transparent',
                  '--color': '#fff'
                }}
              >
                <IonLabel className="ion-text-wrap">
                  <p style={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '0.8rem', 
                    marginBottom: '0.25rem' 
                  }}>
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </p>
                  {segment.text}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        </AccordionSection>
      )}
    </AccordionGroup>
  );
};

export default JobDescriptionAccordion; 