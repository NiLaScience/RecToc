import { IonChip } from '@ionic/react';

interface ListContentProps {
  items: string[];
}

export const ListContent: React.FC<ListContentProps> = ({ items }) => (
  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#fff' }}>
    {items.map((item, index) => (
      <li key={index} style={{ marginBottom: '0.5rem' }}>{item}</li>
    ))}
  </ul>
);

interface ChipsContentProps {
  items: string[];
}

export const ChipsContent: React.FC<ChipsContentProps> = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
    {items.map((item, index) => (
      <IonChip 
        key={index}
        style={{ '--background': '#444', '--color': '#fff' }}
      >
        {item}
      </IonChip>
    ))}
  </div>
);

interface ExperienceItemProps {
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  location?: string;
  highlights: string[];
}

export const ExperienceContent: React.FC<ExperienceItemProps> = ({
  title,
  company,
  startDate,
  endDate,
  current,
  location,
  highlights
}) => (
  <div style={{ marginBottom: '1rem' }}>
    <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{title} at {company}</h4>
    <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
      {startDate} - {current ? 'Present' : endDate}
      {location && ` • ${location}`}
    </p>
    <ul style={{ color: 'rgba(255, 255, 255, 0.7)', paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
      {highlights.map((highlight, i) => (
        <li key={i} style={{ marginBottom: '0.5rem' }}>{highlight}</li>
      ))}
    </ul>
  </div>
);

interface EducationItemProps {
  degree: string;
  field: string;
  institution: string;
  graduationDate?: string;
  gpa?: string;
}

export const EducationContent: React.FC<EducationItemProps> = ({
  degree,
  field,
  institution,
  graduationDate,
  gpa
}) => (
  <div style={{ marginBottom: '1rem' }}>
    <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{degree} in {field}</h4>
    <p style={{ color: '#fff' }}>{institution}</p>
    {graduationDate && (
      <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        Graduated: {graduationDate}
        {gpa && ` • GPA: ${gpa}`}
      </p>
    )}
  </div>
); 