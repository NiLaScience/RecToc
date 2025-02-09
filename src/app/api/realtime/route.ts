import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if API key exists
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return NextResponse.json(
        { error: 'Failed to generate ephemeral token from OpenAI' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data?.client_secret?.value) {
      console.error('Invalid response format from OpenAI:', data);
      return NextResponse.json(
        { error: 'Invalid response format from OpenAI' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating ephemeral token:', error);
    return NextResponse.json(
      { error: 'Internal server error while generating token' },
      { status: 500 }
    );
  }
}
