export interface AgentConfig {
  name: string;
  publicDescription: string;
  instructions: string;
  tools: Array<{
    type: string;
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  }>;
  toolLogic: Record<string, (params: any) => Promise<any>>;
} 