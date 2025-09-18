import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'pdfStorage',
  access: (allow) => ({
    'pdfs/*': [
      allow.guest.to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  })
});
