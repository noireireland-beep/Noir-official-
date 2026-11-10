import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PolaroidSection asset and inscription verification', () => {
  const photo1Path = path.resolve('public/assets/aistudio/edited_three_stripe_bicep_2_f6cf134a.jpg');
  const photo2Path = path.resolve('public/assets/aistudio/file_00000000cc9881f8b295d10f6ec9c43c__2__6d551629.jpg');

  assert.ok(fs.existsSync(photo1Path), 'Photo 1 exists in public assets');
  assert.ok(fs.existsSync(photo2Path), 'Photo 2 exists in public assets');

  const componentPath = path.resolve('src/components/PolaroidSection.tsx');
  assert.ok(fs.existsSync(componentPath), 'PolaroidSection component exists');
  const content = fs.readFileSync(componentPath, 'utf-8');

  // Verify exact requested inscriptions
  assert.ok(
    content.includes('merry Christmas from NOIRÉ'),
    'Front face includes exact handwritten text: merry Christmas from NOIRÉ'
  );
  assert.ok(
    content.includes("Wear your roots, not someone else's uniform"),
    "Back face includes exact handwritten text: Wear your roots, not someone else's uniform"
  );

  // Verify Caveat font usage
  assert.ok(
    content.includes("'Caveat', cursive"),
    "Uses Caveat cursive handwriting font"
  );

  // Verify 3D flip support
  assert.ok(
    content.includes('rotateY(180deg)'),
    'Includes 3D flip transform rotateY(180deg)'
  );
});

test('Footer headline and bold circle outline verification', () => {
  const footerPath = path.resolve('src/components/Footer.tsx');
  const content = fs.readFileSync(footerPath, 'utf-8');

  // Verify strokeWidth is bold
  assert.ok(
    content.includes('strokeWidth="6.5"'),
    'Circle has bold strokeWidth of 6.5'
  );

  // Verify headline text
  assert.ok(
    content.includes('ARCHIVE DROP NO. 01 /'),
    'Footer contains line 1: ARCHIVE DROP NO. 01 /'
  );
  assert.ok(
    content.includes('88 SETS•JUST THE BEGINNING'),
    'Footer contains line 2: 88 SETS•JUST THE BEGINNING'
  );
  assert.ok(
    content.includes('2026®• ie~'),
    'Footer contains line 3: 2026®• ie~'
  );

  // Verify TikTok & WhatsApp image buttons replace Instagram & Editorial Inquiries
  assert.ok(
    content.includes('https://www.tiktok.com/@noire_ie1?_r=1&_t=ZS-9BHs55O7OaK'),
    'Footer includes TikTok URL'
  );
  assert.ok(
    content.includes('/assets/aistudio/80cb644e10fd16f0da157bee10feb8a6_81c7539b.jpg'),
    'Footer includes TikTok image asset'
  );
  assert.ok(
    content.includes('https://wa.me/353899636843'),
    'Footer includes WhatsApp URL for +353899636843'
  );
  assert.ok(
    content.includes('/assets/aistudio/02457c4b7b0f56db2b3e188d5d273509_7f78e4ff.jpg'),
    'Footer includes WhatsApp image asset'
  );
  assert.ok(
    !content.includes('label: "Editorial Inquiries"') && !content.includes('label: "Instagram"'),
    'Footer replaced Instagram and Editorial Inquiries'
  );
});
