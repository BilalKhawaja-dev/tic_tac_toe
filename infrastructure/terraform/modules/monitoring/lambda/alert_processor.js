// Alert Processor Lambda Function
// Processes CloudWatch alarms and sends notifications to Slack/Teams

const https = require('https');
const url = require('url');

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        // Parse SNS message
        const snsMessage = JSON.parse(event.Records[0].Sns.Message);
        
        // Extract alarm details
        const alarmName = snsMessage.AlarmName;
        const alarmDescription = snsMessage.AlarmDescription;
        const newState = snsMessage.NewStateValue;
        const oldState = snsMessage.OldStateValue;
        const reason = snsMessage.NewStateReason;
        const timestamp = snsMessage.StateChangeTime;
        const region = snsMessage.Region;
        const accountId = snsMessage.AWSAccountId;
        
        // Determine severity and color
        const severity = getSeverity(alarmName, newState);
        const color = getColor(severity, newState);
        const emoji = getEmoji(severity, newState);
        
        // Create notification payload
        const notification = {
            timestamp: new Date().toISOString(),
            alarm: {
                name: alarmName,
                description: alarmDescription,
                newState: newState,
                oldState: oldState,
                reason: reason,
                timestamp: timestamp,
                region: region,
                accountId: accountId
            },
            severity: severity,
            project: '${project_name}'
        };
        
        // Send to Slack if webhook URL is configured
        if (process.env.SLACK_WEBHOOK_URL) {
            await sendSlackNotification(notification, color, emoji);
        }
        
        // Send to Teams if webhook URL is configured
        if (process.env.TEAMS_WEBHOOK_URL) {
            await sendTeamsNotification(notification, color);
        }
        
        console.log('Alert processed successfully');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Alert processed successfully',
                alarmName: alarmName,
                newState: newState
            })
        };
        
    } catch (error) {
        console.error('Error processing alert:', error);
        throw error;
    }
};

function getSeverity(alarmName, state) {
    if (state !== 'ALARM') {
        return 'info';
    }
    
    // Critical alarms
    if (alarmName.includes('system-health') || 
        alarmName.includes('high-error-rate') ||
        alarmName.includes('database-down')) {
        return 'critical';
    }
    
    // Warning alarms
    if (alarmName.includes('high-cpu') || 
        alarmName.includes('high-response-time') ||
        alarmName.includes('high-connections')) {
        return 'warning';
    }
    
    return 'info';
}

function getColor(severity, state) {
    if (state === 'OK') {
        return '#36a64f'; // Green
    }
    
    switch (severity) {
        case 'critical':
            return '#ff0000'; // Red
        case 'warning':
            return '#ff9900'; // Orange
        case 'info':
            return '#0099ff'; // Blue
        default:
            return '#808080'; // Gray
    }
}

function getEmoji(severity, state) {
    if (state === 'OK') {
        return '✅';
    }
    
    switch (severity) {
        case 'critical':
            return '🚨';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '📊';
    }
}

async function sendSlackNotification(notification, color, emoji) {
    const slackPayload = {
        username: 'AWS CloudWatch',
        icon_emoji: ':warning:',
        attachments: [
            {
                color: color,
                title: `${emoji} ${notification.alarm.name}`,
                text: notification.alarm.description,
                fields: [
                    {
                        title: 'State',
                        value: `${notification.alarm.oldState} → ${notification.alarm.newState}`,
                        short: true
                    },
                    {
                        title: 'Severity',
                        value: notification.severity.toUpperCase(),
                        short: true
                    },
                    {
                        title: 'Region',
                        value: notification.alarm.region,
                        short: true
                    },
                    {
                        title: 'Project',
                        value: notification.project,
                        short: true
                    },
                    {
                        title: 'Reason',
                        value: notification.alarm.reason,
                        short: false
                    }
                ],
                footer: 'AWS CloudWatch',
                ts: Math.floor(new Date(notification.alarm.timestamp).getTime() / 1000)
            }
        ]
    };
    
    await sendWebhook(process.env.SLACK_WEBHOOK_URL, slackPayload);
}

async function sendTeamsNotification(notification, color) {
    const teamsPayload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `CloudWatch Alert: ${notification.alarm.name}`,
        themeColor: color.replace('#', ''),
        sections: [
            {
                activityTitle: `CloudWatch Alert: ${notification.alarm.name}`,
                activitySubtitle: notification.alarm.description,
                facts: [
                    {
                        name: 'State Change',
                        value: `${notification.alarm.oldState} → ${notification.alarm.newState}`
                    },
                    {
                        name: 'Severity',
                        value: notification.severity.toUpperCase()
                    },
                    {
                        name: 'Region',
                        value: notification.alarm.region
                    },
                    {
                        name: 'Project',
                        value: notification.project
                    },
                    {
                        name: 'Reason',
                        value: notification.alarm.reason
                    },
                    {
                        name: 'Timestamp',
                        value: notification.alarm.timestamp
                    }
                ]
            }
        ]
    };
    
    await sendWebhook(process.env.TEAMS_WEBHOOK_URL, teamsPayload);
}

async function sendWebhook(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(webhookUrl);
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('Webhook sent successfully:', res.statusCode);
                    resolve(data);
                } else {
                    console.error('Webhook failed:', res.statusCode, data);
                    reject(new Error(`Webhook failed with status ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Webhook request error:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}