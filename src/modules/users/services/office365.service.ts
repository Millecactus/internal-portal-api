import { ConfidentialClientApplication } from '@azure/msal-node';

class Office365Service {
    private msalClient: ConfidentialClientApplication;
    private readonly OFFICE_365_A1_SKU_ID = '94763226-9b3c-4e75-a931-5c89701abe66';

    constructor() {
        const authority = `https://login.microsoftonline.com/${process.env.AZURE_TENANT}`;

        this.msalClient = new ConfidentialClientApplication({
            auth: {
                clientId: process.env.AZURE_CLIENT_ID!,
                authority: authority,
                clientSecret: process.env.AZURE_CLIENT_SECRET!,
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel: any, message: any) {
                    },
                    piiLoggingEnabled: false,
                    logLevel: 3 // Info
                }
            }
        });
    }

    private async getGraphToken(): Promise<string> {
        const tokenRequest = {
            scopes: ['https://graph.microsoft.com/.default']
        };

        const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);
        if (!response?.accessToken) {
            console.error('Impossible d\'obtenir le token Graph');
        }
        return response?.accessToken || '';
    }

    private generateTemporaryPassword(): string {
        return 'Temp' + Math.random().toString(36).slice(-8) + '!';
    }

    async createUser(userData: { firstname: string; lastname: string; email: string }): Promise<any> {
        const accessToken = await this.getGraphToken();
        const graphApiEndpoint = 'https://graph.microsoft.com/v1.0/users';

        const m365User = {
            accountEnabled: true,
            displayName: `${userData.firstname} ${userData.lastname}`,
            mailNickname: userData.email.split('@')[0],
            userPrincipalName: userData.email,
            usageLocation: 'FR',
            passwordProfile: {
                forceChangePasswordNextSignIn: true,
                password: this.generateTemporaryPassword()
            },
            givenName: userData.firstname,
            surname: userData.lastname,
            userType: 'Member'
        };


        try {
            // Créer l'utilisateur dans Microsoft 365
            const response = await fetch(graphApiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ConsistencyLevel': 'eventual',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(m365User)
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Erreur Microsoft Graph: ${response.statusText} - ${responseText}`);
            }

            const user = JSON.parse(responseText);

            // Attribuer une licence
            if (user.id) {
                await this.assignLicense(user.id, accessToken);
            }

            return user;
        } catch (error) {
            console.error('Erreur lors de la création du compte M365:', error);
            throw error;
        }
    }

    private async getAvailableSkus(accessToken: string): Promise<any> {
        const skusEndpoint = 'https://graph.microsoft.com/v1.0/subscribedSkus';

        const response = await fetch(skusEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des SKUs: ${response.statusText} - ${responseText}`);
        }

        return JSON.parse(responseText);
    }

    private async assignLicense(userId: string, accessToken: string): Promise<void> {
        try {
            // Récupérer d'abord les SKUs disponibles
            const skus = await this.getAvailableSkus(accessToken);

            // Utiliser l'endpoint v1.0 et le bon format
            const licenseEndpoint = `https://graph.microsoft.com/v1.0/users/${userId}/assignLicense`;

            const licenseBody = {
                addLicenses: [
                    {
                        skuId: this.OFFICE_365_A1_SKU_ID,
                        disabledPlans: []
                    }
                ],
                removeLicenses: []
            };


            const response = await fetch(licenseEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(licenseBody)
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Erreur lors de l'attribution de la licence: ${response.statusText} - ${responseText}`);
            }
        } catch (error) {
            console.error('Erreur complète lors de l\'attribution de la licence:', error);
            throw error;
        }
    }
}

export default new Office365Service();
