import { hostingErrors } from '../src/lib/hostingEnvironment.mjs';
const errors = hostingErrors(process.env, { release: true });
if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
else console.log('Hosting variables pass validation. Still verify published Firebase rules, the promoted Vercel alias, and an authenticated retry scheduler.');
