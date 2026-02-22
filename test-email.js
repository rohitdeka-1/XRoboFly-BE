import { sendMail } from './src/services/mailer.services.js';

// Test email sending
async function testEmail() {
    try {
        console.log('Testing email system...');
        
        const result = await sendMail(
            'xrobofly@gmail.com',
            'Test Email - XRoboFly',
            'welcome',
            {
                name: 'Test User',
                email: 'test@example.com',
                registrationDate: new Date().toLocaleDateString(),
                role: 'Customer',
                frontendUrl: 'http://localhost:5173',
                year: new Date().getFullYear()
            }
        );
        
        console.log('Email sent successfully:', result);
        process.exit(0);
    } catch (error) {
        console.error('Email test failed:', error);
        process.exit(1);
    }
}

testEmail();
