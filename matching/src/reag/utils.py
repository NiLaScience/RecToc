def format_job_content(job_dict):
    """Format job fields into a readable string."""
    desc = job_dict.get("jobDescription", {})
    return f"""Title: {desc.get('title', 'No Title')}
Company: {desc.get('company', 'Not Specified')}
Location: {desc.get('location', 'Not Specified')}
Employment Type: {desc.get('employmentType', 'Not Specified')}
Experience Level: {desc.get('experienceLevel', 'Not Specified')}
Salary: {desc.get('salary', 'Not Specified')}

Requirements:
{desc.get('requirements', 'Not Specified')}

Responsibilities:
{desc.get('responsibilities', 'Not Specified')}

Skills:
{', '.join(desc.get('skills', []))}

Benefits:
{desc.get('benefits', 'Not Specified')}""" 