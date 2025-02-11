import React, { useState } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent } from '@ionic/react';
import AccordionGroup from './AccordionGroup';
import AccordionSection from './AccordionSection';
import { ExperienceContent, EducationContent, ChipsContent } from './AccordionContent';

interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  highlights: string[];
}

interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationDate?: string;
  gpa?: number;
}

interface Skill {
  category: string;
  items: string[];
}

interface Certification {
  name: string;
  issuer: string;
  date?: string;
}

interface Language {
  language: string;
  proficiency: string;
}

interface PersonalInfo {
  summary?: string;
  location?: string;
}

interface CVAccordionProps {
  personalInfo?: PersonalInfo;
  experience?: Experience[];
  education?: Education[];
  skills?: Skill[];
  certifications?: Certification[];
  languages?: Language[];
  displayName?: string;
  showCard?: boolean;
}

const CVAccordion: React.FC<CVAccordionProps> = ({
  personalInfo,
  experience,
  education,
  skills,
  certifications,
  languages,
  displayName,
  showCard = true
}) => {
  const [openSections, setOpenSections] = useState<string[]>([]);

  const handleAccordionChange = (value: string) => {
    setOpenSections(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const accordionContent = (
    <AccordionGroup value={openSections.join(',')}>
      {personalInfo?.summary && (
        <AccordionSection 
          value="summary" 
          label="Professional Summary"
          onClick={() => handleAccordionChange('summary')}
        >
          <p style={{ color: '#fff' }}>{personalInfo.summary}</p>
        </AccordionSection>
      )}

      {experience && experience.length > 0 && (
        <AccordionSection 
          value="experience" 
          label="Experience"
          onClick={() => handleAccordionChange('experience')}
        >
          {experience.map((exp, index) => (
            <ExperienceContent
              key={index}
              title={exp.title}
              company={exp.company}
              startDate={exp.startDate}
              endDate={exp.endDate}
              current={exp.current}
              location={exp.location}
              highlights={exp.highlights}
            />
          ))}
        </AccordionSection>
      )}

      {education && education.length > 0 && (
        <AccordionSection 
          value="education" 
          label="Education"
          onClick={() => handleAccordionChange('education')}
        >
          {education.map((edu, index) => (
            <EducationContent
              key={index}
              degree={edu.degree}
              field={edu.field}
              institution={edu.institution}
              graduationDate={edu.graduationDate}
              gpa={edu.gpa?.toString()}
            />
          ))}
        </AccordionSection>
      )}

      {skills && skills.length > 0 && (
        <AccordionSection 
          value="skills" 
          label="Skills"
          onClick={() => handleAccordionChange('skills')}
        >
          {skills.map((skillGroup, index) => (
            <div key={index} style={{ marginBottom: index < skills.length - 1 ? '1rem' : 0 }}>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{skillGroup.category}</h4>
              <ChipsContent items={skillGroup.items} />
            </div>
          ))}
        </AccordionSection>
      )}

      {certifications && certifications.length > 0 && (
        <AccordionSection 
          value="certifications" 
          label="Certifications"
          onClick={() => handleAccordionChange('certifications')}
        >
          {certifications.map((cert, index) => (
            <div key={index} style={{ marginBottom: index < certifications.length - 1 ? '1rem' : 0 }}>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{cert.name}</h4>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {cert.issuer}
                {cert.date && ` • ${cert.date}`}
              </p>
            </div>
          ))}
        </AccordionSection>
      )}

      {languages && languages.length > 0 && (
        <AccordionSection 
          value="languages" 
          label="Languages"
          onClick={() => handleAccordionChange('languages')}
        >
          <ChipsContent 
            items={languages.map(lang => `${lang.language} - ${lang.proficiency}`)} 
          />
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
        {(displayName || personalInfo?.location) && (
          <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {displayName}
            {personalInfo?.location && (displayName ? ` • ${personalInfo.location}` : personalInfo.location)}
          </IonCardSubtitle>
        )}
      </IonCardHeader>
      <IonCardContent>
        {accordionContent}
      </IonCardContent>
    </IonCard>
  );
};

export default CVAccordion; 