const admin = require('firebase-admin');
const serviceAccount = require('./firebase-credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setupAgentAuth() {
  try {
    // Create a service account user for the agent
    const agentEmail = 'agent-service@rectoc.com';  // Use your domain
    const agentPassword = process.env.AGENT_PASSWORD; // Set this securely

    // Create the user if it doesn't exist
    let agentUser;
    try {
      agentUser = await admin.auth().getUserByEmail(agentEmail);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        agentUser = await admin.auth().createUser({
          email: agentEmail,
          password: agentPassword,
          displayName: 'Application Agent Service'
        });
        console.log('Created agent service account:', agentUser.uid);
      } else {
        throw error;
      }
    }

    // Set custom claims for the agent
    await admin.auth().setCustomUserClaims(agentUser.uid, {
      agent: true
    });

    console.log('Successfully set up agent authentication with custom claims');
    console.log('Agent UID:', agentUser.uid);
    
    // For EC2 setup, save these credentials
    const agentCredentials = {
      email: agentEmail,
      password: agentPassword,
      uid: agentUser.uid
    };
    
    console.log('Use these credentials in your EC2 environment:');
    console.log(JSON.stringify(agentCredentials, null, 2));

  } catch (error) {
    console.error('Error setting up agent auth:', error);
  } finally {
    process.exit();
  }
}

setupAgentAuth(); 