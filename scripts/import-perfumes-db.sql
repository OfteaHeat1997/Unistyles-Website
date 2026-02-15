-- Import Perfumes to Strapi Database
-- Category ID 40 = Perfumes

-- First, get the brand IDs
-- Avon = need to create
-- Cyzone = 25
-- Esika = 23
-- L'Bel = 22
-- Yanbal = 24

-- Create Avon brand if not exists
INSERT INTO brands (name, slug, tagline, created_at, updated_at, published_at)
SELECT 'Avon', 'avon', 'Avon Colombian fragrances', NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug = 'avon');

-- Delete existing perfume products to reimport fresh
DELETE FROM products_category_links WHERE category_id = 40;
DELETE FROM products_brand_links WHERE product_id IN (SELECT id FROM products WHERE ref LIKE 'COL-%');
DELETE FROM products WHERE ref LIKE 'COL-%';

-- Import all perfumes
INSERT INTO products (name, slug, ref, description, price, in_stock, legacy_image, created_at, updated_at, published_at)
VALUES
('Pasion Dance Para Hombre', 'pasion-dance-para-hombre', 'COL-AV01', 'Men''s fresh and energetic fragrance with citrus top notes spicy heart and woody base.', 19, true, '/images/perfumes/Pasion Dance Para Hombre avon.jpg', NOW(), NOW(), NOW()),
('Soft Musk Delice', 'soft-musk-delice', 'COL-AV02', 'Women''s sweet and delicate fragrance with vanilla caramel and soft musk notes.', 19, true, '/images/perfumes/Soft Musk Delice.jpg', NOW(), NOW(), NOW()),
('Ainnara', 'ainnara', 'COL-CY01', 'Women''s floral frutal perfume with raspberry jasmine and sandalwood notes.', 19, true, '/images/perfumes/Ainnara cyzone.jpg', NOW(), NOW(), NOW()),
('Autenti-K', 'autenti-k', 'COL-CY02', 'Premium fragrance with distinctive character and quality notes.', 19, true, '/images/perfumes/Autenti-K ceyzone.jpg', NOW(), NOW(), NOW()),
('Berry Cocktail', 'berry-cocktail', 'COL-CY03', 'Refreshing splash with mixed berries and sweet fruity notes.', 19, true, '/images/perfumes/Berry Cocktail ceysone.jpg', NOW(), NOW(), NOW()),
('Blue Blue For Her', 'blue-blue-for-her', 'COL-CY04', 'Premium fragrance with distinctive character and quality notes.', 19, true, '/images/perfumes/Blue Blue For Her cyzone.jpg', NOW(), NOW(), NOW()),
('Blue Blue For Him', 'blue-blue-for-him', 'COL-CY05', 'Premium fragrance with distinctive character and quality notes.', 19, true, '/images/perfumes/Blue Blue For Him cyzone.jpg', NOW(), NOW(), NOW()),
('Dancing', 'dancing', 'COL-CY06', 'Vibrant women''s fragrance with fruity and floral notes for a joyful spirit.', 19, true, '/images/perfumes/Dancing ceyzone.jpg', NOW(), NOW(), NOW()),
('Dancing Night', 'dancing-night', 'COL-CY07', 'Seductive evening fragrance with dark florals vanilla and amber.', 19, true, '/images/perfumes/Dancing Night cyzone.jpg', NOW(), NOW(), NOW()),
('Dream', 'dream', 'COL-CY08', 'Dreamy feminine scent with soft florals peach and creamy musk.', 19, true, '/images/perfumes/Dream ceyzone.png', NOW(), NOW(), NOW()),
('Fist', 'fist', 'COL-CY09', 'Bold men''s fragrance with fresh spicy opening and powerful woody base.', 19, true, '/images/perfumes/Fist ceyzone.jpg', NOW(), NOW(), NOW()),
('Fist Team', 'fist-team', 'COL-CY10', 'Energetic men''s sport fragrance with fresh citrus and aromatic notes.', 19, true, '/images/perfumes/Fist team.png', NOW(), NOW(), NOW()),
('Forze', 'forze', 'COL-CY11', 'Dynamic men''s fragrance with fresh aromatic notes and woody base.', 19, true, '/images/perfumes/Forze  ceyzone.jpg', NOW(), NOW(), NOW()),
('Forze Unlimited', 'forze-unlimited', 'COL-CY12', 'Intense masculine scent with spicy notes lavender and powerful woods.', 19, true, '/images/perfumes/Forze Unlimited cyzone.jpg', NOW(), NOW(), NOW()),
('Girlink', 'girlink', 'COL-CY13', 'Young feminine fragrance with sweet fruity notes and soft florals.', 19, true, '/images/perfumes/Girlink cyzone.jpg', NOW(), NOW(), NOW()),
('Identity Bloom', 'identity-bloom', 'COL-CY14', 'Floral feminine perfume with fresh blooming flowers and green notes.', 19, true, '/images/perfumes/Identity Bloom ceyzone.jpg', NOW(), NOW(), NOW()),
('Inlove', 'inlove', 'COL-CY15', 'Romantic women''s fragrance with rose jasmine and sweet vanilla.', 19, true, '/images/perfumes/Inlove cyzone.jpg', NOW(), NOW(), NOW()),
('Maracuya Passion', 'maracuya-passion', 'COL-CY16', 'Tropical splash with exotic passion fruit and sweet citrus notes.', 19, true, '/images/perfumes/Maracuya Passion.jpg', NOW(), NOW(), NOW()),
('Mora Potion', 'mora-potion', 'COL-CY18', 'Sweet splash with blackberry and enchanting fruity notes.', 19, true, '/images/perfumes/Mora Potion.jpg', NOW(), NOW(), NOW()),
('Nitro', 'nitro', 'COL-CY19', 'Intense men''s fragrance with fresh ozonic notes and powerful woods.', 19, true, '/images/perfumes/Nitro ceyzone.jpg', NOW(), NOW(), NOW()),
('Nitro Adventure', 'nitro-adventure', 'COL-CY20', 'Adventurous men''s scent with fresh spices and earthy woods.', 19, true, '/images/perfumes/Nitro Adventure.jpg', NOW(), NOW(), NOW()),
('Nitro Air', 'nitro-air', 'COL-CY21', 'Light fresh men''s cologne with airy notes citrus and clean musk.', 19, true, '/images/perfumes/Nitro Air cyzone.jpg', NOW(), NOW(), NOW()),
('Nitro Intense', 'nitro-intense', 'COL-CY22', 'Powerful masculine fragrance with intense spices and deep amber.', 19, true, '/images/perfumes/Nitro Intense.jpg', NOW(), NOW(), NOW()),
('Nitro Night', 'nitro-night', 'COL-CY23', 'Seductive evening cologne with dark spices leather and smoky notes.', 19, true, '/images/perfumes/Nitro Night cyzone.jpg', NOW(), NOW(), NOW()),
('Nitro Ocean', 'nitro-ocean', 'COL-CY24', 'Fresh ocean men''s cologne with marine notes and aquatic freshness.', 19, true, '/images/perfumes/Nitro Ocean cyzone.jpg', NOW(), NOW(), NOW()),
('Nitro Ultimate', 'nitro-ultimate', 'COL-CY25', 'Ultimate men''s fragrance with maximum intensity and power.', 19, true, '/images/perfumes/Nitro Ultimate cyzone.png', NOW(), NOW(), NOW()),
('Sweet Black', 'sweet-black', 'COL-CY32', 'Iconic feminine fragrance with dark fruits vanilla and sensual musk.', 19, true, '/images/perfumes/Sweet Black cyzone oficial.jpg', NOW(), NOW(), NOW()),
('Sweet Black Chic', 'sweet-black-chic', 'COL-CY33', 'Elegant version with refined dark berries and sophisticated amber.', 19, true, '/images/perfumes/Sweet Black Chic.jpg', NOW(), NOW(), NOW()),
('Sweet Black Exclusive', 'sweet-black-exclusive', 'COL-CY34', 'Exclusive edition with premium dark notes and luxurious depth.', 19, true, '/images/perfumes/Sweet Black Exclusive cyzone.jpg', NOW(), NOW(), NOW()),
('Sweet Black Intense', 'sweet-black-intense', 'COL-CY35', 'Intensified version with deeper fruits and richer vanilla notes.', 19, true, '/images/perfumes/Sweet Black Intense cyzone.jpg', NOW(), NOW(), NOW()),
('Sweet Black Pink Addict', 'sweet-black-pink-addict', 'COL-CY36', 'Pink addictive version with feminine sweetness and playful charm.', 19, true, '/images/perfumes/Sweet Black Pink Addict cyzone.jpg', NOW(), NOW(), NOW()),
('Viva Happy', 'viva-happy', 'COL-CY40', 'Uplifting feminine scent with cheerful citrus and bright florals.', 19, true, '/images/perfumes/Viva Happy cyzone.jpg', NOW(), NOW(), NOW()),
('New Cool', 'new-cool', 'COL-CY41', 'Cool modern fragrance with fresh innovation and relaxed style.', 19, true, '/images/perfumes/New Cool cyzone.jpg', NOW(), NOW(), NOW()),
('All Black', 'all-black', 'COL-CY42', 'Dark sophisticated men''s fragrance with bold mysterious notes.', 19, true, '/images/perfumes/All Black cyzone.jpg', NOW(), NOW(), NOW()),
('Alma', 'alma', 'COL-ES03', 'Soulful women''s fragrance with warm florals and comforting woods.', 19, true, '/images/perfumes/Alma esika.jpg', NOW(), NOW(), NOW()),
('Altheus Para Hombre', 'altheus-para-hombre', 'COL-ES04', 'Classic masculine fragrance with aromatic herbs and elegant woods.', 19, true, '/images/perfumes/Altheus Para Hombre.jpg', NOW(), NOW(), NOW()),
('Aura Lila', 'aura-lila', 'COL-ES05', 'Delicate feminine scent with purple lilac and soft floral notes.', 19, true, '/images/perfumes/Aura Lila.jpg', NOW(), NOW(), NOW()),
('Bela', 'bela', 'COL-ES06', 'Beautiful women''s perfume with elegant florals and feminine musk.', 19, true, '/images/perfumes/Bela esika.jpg', NOW(), NOW(), NOW()),
('Comando Force', 'comando-force', 'COL-ES08', 'Powerful kids boy fragrance with intense spices and commanding woods.', 19, true, '/images/perfumes/Comando Force esika.jpg', NOW(), NOW(), NOW()),
('Dorsay Inspire Para Hombre', 'dorsay-inspire-para-hombre', 'COL-ES11', 'Inspiring masculine scent with fresh aromatics and noble woods.', 19, true, '/images/perfumes/Dorsay Inspire esika.jpg', NOW(), NOW(), NOW()),
('Expression', 'expression', 'COL-ES12', 'Expressive women''s perfume with bold florals and confident notes.', 19, true, '/images/perfumes/Expression esika.jpg', NOW(), NOW(), NOW()),
('Expression Sense', 'expression-sense', 'COL-ES13', 'Sensual version with deeper florals and intimate musk.', 19, true, '/images/perfumes/Expression Sense esika.jpg', NOW(), NOW(), NOW()),
('Fantasia Azul Infinito', 'fantasia-azul-infinito', 'COL-ES14', 'Dreamy blue floral with infinite sky notes and soft sweetness.', 19, true, '/images/perfumes/Fantasia Azul Infinito esika.png', NOW(), NOW(), NOW()),
('Femme Magnat', 'femme-magnat', 'COL-ES15', 'Feminine counterpart with elegant florals and refined sophistication.', 19, true, '/images/perfumes/Femme Magnat.jpg', NOW(), NOW(), NOW()),
('Grazzia Rosado', 'grazzia-rosado', 'COL-ES16', 'Romantic pink floral with soft roses and delicate femininity.', 19, true, '/images/perfumes/Grazzia Rosado.jpg', NOW(), NOW(), NOW()),
('Its You Since 1997', 'its-you-since-1997', 'COL-ES22', 'Iconic women''s perfume with timeless elegance since 1997.', 19, true, '/images/perfumes/Its You Since 1997 esika.jpg', NOW(), NOW(), NOW()),
('Limage', 'limage', 'COL-ES24', 'Sophisticated women''s fragrance with refined French elegance.', 19, true, '/images/perfumes/Limage esika.jpg', NOW(), NOW(), NOW()),
('Magnat Para Hombre', 'magnat-para-hombre', 'COL-ES25', 'Distinguished men''s cologne with powerful woods and authority.', 19, true, '/images/perfumes/Magnat esika.jpg', NOW(), NOW(), NOW()),
('Magnat Select', 'magnat-select', 'COL-ES26', 'Select edition with premium woods and exclusive sophistication.', 19, true, '/images/perfumes/Magnat Select esika.jpg', NOW(), NOW(), NOW()),
('Mia Sensual Night', 'mia-sensual-night', 'COL-ES29', 'Sensual evening version with seductive florals and night mystery.', 19, true, '/images/perfumes/Mia Sensual Night esika.png', NOW(), NOW(), NOW()),
('Pulso Absolute', 'pulso-absolute', 'COL-ES34', 'Absolute version with intensified energy and powerful presence.', 19, true, '/images/perfumes/Pulso Absolute esika.jpg', NOW(), NOW(), NOW()),
('Red Intense', 'red-intense', 'COL-ES35', 'Intense red feminine fragrance with passionate notes and fire.', 19, true, '/images/perfumes/Red Intense esika.jpg', NOW(), NOW(), NOW()),
('Red Power', 'red-power', 'COL-ES36', 'Powerful red men''s scent with commanding strength and boldness.', 19, true, '/images/perfumes/Red power esika.png', NOW(), NOW(), NOW()),
('Vibranza', 'vibranza', 'COL-ES43', 'Vibrant women''s perfume with energetic florals and lively spirit.', 19, true, '/images/perfumes/Vibranza esika.jpg', NOW(), NOW(), NOW()),
('Vibranza Addiction', 'vibranza-addiction', 'COL-ES44', 'Addictive version with irresistible notes and captivating allure.', 19, true, '/images/perfumes/Vibranza Addiction.jpg', NOW(), NOW(), NOW()),
('Vibranza Blanc', 'vibranza-blanc', 'COL-ES45', 'White floral version with pure blooms and pristine elegance.', 19, true, '/images/perfumes/Vibranza Blanc esika.jpg', NOW(), NOW(), NOW()),
('Vibranza Iluminour', 'vibranza-iluminour', 'COL-ES46', 'Luminous edition with radiant florals and glowing warmth.', 19, true, '/images/perfumes/Vibranza Iluminour.jpg', NOW(), NOW(), NOW()),
('Vivir', 'vivir', 'COL-ES47', 'Living women''s fragrance celebrating life with joyful notes.', 19, true, '/images/perfumes/Vivir esika.jpg', NOW(), NOW(), NOW()),
('Winner Max', 'winner-max', 'COL-ES48', 'Maximum winner men''s fragrance with peak performance notes.', 19, true, '/images/perfumes/Winner Max esika.jpg', NOW(), NOW(), NOW()),
('Winner Sport', 'winner-sport', 'COL-ES49', 'Sporty men''s fragrance with athletic freshness and victory notes.', 19, true, '/images/perfumes/Winner Sport esika.jpg', NOW(), NOW(), NOW()),
('Winner Traxion', 'winner-traxion', 'COL-ES50', 'Traction men''s scent with grip power and unstoppable drive.', 19, true, '/images/perfumes/Winner Traxion.jpg', NOW(), NOW(), NOW()),
('Vanilla Para Hombre', 'vanilla-para-hombre', 'COL-ES42', 'Men''s vanilla cologne with warm spices and masculine sweetness.', 19, true, '/images/perfumes/Vanilla Para Hombre esika.jpg', NOW(), NOW(), NOW()),
('Aqua', 'aqua', 'COL-LB01', 'Fresh aquatic women''s fragrance with pure water notes and clarity.', 19, true, '/images/perfumes/Aqua lbel.jpg', NOW(), NOW(), NOW()),
('Bleu Femme', 'bleu-femme', 'COL-LB02', 'Blue feminine fragrance with fresh marine and elegant notes.', 19, true, '/images/perfumes/Bleu Femme lbel.jpg', NOW(), NOW(), NOW()),
('Bleu Femme Capri', 'bleu-femme-capri', 'COL-LB03', 'Capri edition with Italian coastal freshness and Mediterranean charm.', 19, true, '/images/perfumes/Bleu Femme Capri lbel.jpg', NOW(), NOW(), NOW()),
('Bleu Intense', 'bleu-intense', 'COL-LB04', 'Intense blue men''s cologne with deep marine and powerful woods.', 19, true, '/images/perfumes/Bleu Intense lbel.jpg', NOW(), NOW(), NOW()),
('Bleu Night', 'bleu-night', 'COL-LB05', 'Nocturnal blue fragrance with mysterious night notes and depth.', 19, true, '/images/perfumes/Bleu Night lbel.jpg', NOW(), NOW(), NOW()),
('Devos Magnetic', 'devos-magnetic', 'COL-LB10', 'Magnetic men''s cologne with attractive power and irresistible pull.', 19, true, '/images/perfumes/Devos Magnetic.jpg', NOW(), NOW(), NOW()),
('Emouv', 'emouv', 'COL-LB11', 'Moving women''s fragrance with emotional depth and touching notes.', 19, true, '/images/perfumes/Emouv lbel.jpg', NOW(), NOW(), NOW()),
('Empire', 'empire', 'COL-LB12', 'Imperial men''s fragrance with royal authority and noble woods.', 19, true, '/images/perfumes/Empire lbel.jpg', NOW(), NOW(), NOW()),
('Fleur Divine', 'fleur-divine', 'COL-LB13', 'Divine floral women''s perfume with heavenly blooms and grace.', 19, true, '/images/perfumes/Fleur Divine lbel.jpg', NOW(), NOW(), NOW()),
('Fleur Icon', 'fleur-icon', 'COL-LB14', 'Iconic floral with signature blooms and memorable elegance.', 19, true, '/images/perfumes/Fleur Icon lbel.jpg', NOW(), NOW(), NOW()),
('Homme 033', 'homme-033', 'COL-LB15', 'Men''s cologne #033 with distinctive character and modern style.', 19, true, '/images/perfumes/Homme 033 L''Bel.jpg', NOW(), NOW(), NOW()),
('Hypnotisant', 'hypnotisant', 'COL-LB16', 'Hypnotizing women''s fragrance with mesmerizing allure and spell.', 19, true, '/images/perfumes/Hypnotisant lbel.jpg', NOW(), NOW(), NOW()),
('Id', 'id-lbel', 'COL-LB17', 'Identity fragrance with personal signature and unique character.', 19, true, '/images/perfumes/Id  L''Bel.jpg', NOW(), NOW(), NOW()),
('Liasson', 'liasson', 'COL-LB18', 'Liaison women''s scent with romantic connection and intimate bonds.', 19, true, '/images/perfumes/Liasson.jpg', NOW(), NOW(), NOW()),
('Miss', 'miss', 'COL-LB19', 'Miss women''s fragrance with youthful charm and fresh femininity.', 19, true, '/images/perfumes/Miss lbel.jpg', NOW(), NOW(), NOW()),
('Mithyka', 'mithyka', 'COL-LB20', 'Mythical women''s perfume with legendary elegance and timeless allure.', 19, true, '/images/perfumes/Mithyka lbel.jpg', NOW(), NOW(), NOW()),
('Mithyka L Encant', 'mithyka-lencant', 'COL-LB21', 'Enchanted mythical version with magical charm and spellbinding beauty.', 19, true, '/images/perfumes/Mithyka L''Encant lbel.jpg', NOW(), NOW(), NOW()),
('Mithyka Lumiere', 'mithyka-lumiere', 'COL-LB22', 'Luminous mythical version with radiant light and ethereal beauty.', 19, true, '/images/perfumes/Mithyka Lumiere lbel.jpg', NOW(), NOW(), NOW()),
('Mon', 'mon', 'COL-LB23', 'Personal feminine fragrance meaning mine with intimate possession.', 19, true, '/images/perfumes/Mon.jpg', NOW(), NOW(), NOW()),
('Mon Pink', 'mon-pink', 'COL-LB24', 'Pink edition with playful femininity and rosy sweetness.', 19, true, '/images/perfumes/Mon pink.jpg', NOW(), NOW(), NOW()),
('New Code', 'new-code', 'COL-LB25', 'Modern coded men''s cologne with contemporary sophistication.', 19, true, '/images/perfumes/New Code lbel.jpg', NOW(), NOW(), NOW()),
('New Code Red', 'new-code-red', 'COL-LB26', 'Red coded edition with passionate intensity and bold character.', 19, true, '/images/perfumes/New Code Red.jpg', NOW(), NOW(), NOW()),
('Reve Sensuelle', 'reve-sensuelle', 'COL-LB27', 'Sensual dream women''s fragrance with seductive reverie and desire.', 19, true, '/images/perfumes/Reve Sensuelle lbel.jpg', NOW(), NOW(), NOW()),
('Rose D Amelie', 'rose-damelie', 'COL-LB28', 'Amelie''s rose with romantic pink blooms and French elegance.', 19, true, '/images/perfumes/Rose D''Amelie lbel.jpg', NOW(), NOW(), NOW()),
('Satin Nude', 'satin-nude', 'COL-LB29', 'Nude satin women''s scent with bare elegance and soft sensuality.', 19, true, '/images/perfumes/Satin Nude.jpg', NOW(), NOW(), NOW()),
('Satin Rouge', 'satin-rouge', 'COL-LB30', 'Red satin fragrance with luxurious passion and silky seduction.', 19, true, '/images/perfumes/Satin Rouge lbel.jpg', NOW(), NOW(), NOW()),
('43N Paralel Para Hombre', '43n-paralel-para-hombre', 'COL-YB01', 'Men''s cologne inspired by 43rd parallel with geographic freshness.', 19, true, '/images/perfumes/43N Paralel Para Hombre.jpg', NOW(), NOW(), NOW()),
('Adrenaline Alegria Mujer', 'adrenaline-alegria-mujer', 'COL-YB02', 'Joyful adrenaline women''s scent with happy energy and excitement.', 19, true, '/images/perfumes/Adrenaline Alegria Mujer.jpg', NOW(), NOW(), NOW()),
('Adrenaline Hombre', 'adrenaline-hombre', 'COL-YB03', 'Men''s adrenaline fragrance with rushing energy and thrill.', 19, true, '/images/perfumes/Adrenaline Hombre yanbal.jpg', NOW(), NOW(), NOW()),
('Adrenaline Mujer Roja', 'adrenaline-mujer-roja', 'COL-YB04', 'Red adrenaline women''s edition with passionate intensity.', 19, true, '/images/perfumes/Adrenaline Mujer Roja.jpeg', NOW(), NOW(), NOW()),
('Arom', 'arom', 'COL-YB05', 'Aromatic men''s cologne with herbal freshness and masculine herbs.', 19, true, '/images/perfumes/Arom.jpg', NOW(), NOW(), NOW()),
('Arom Element', 'arom-element', 'COL-YB06', 'Elemental aromatic with pure herbal essence and natural power.', 19, true, '/images/perfumes/Arom Element.jpg', NOW(), NOW(), NOW()),
('Ccori Oro', 'ccori-oro', 'COL-YB07', 'Golden Ccori with luxurious gold notes and radiant warmth.', 19, true, '/images/perfumes/Ccori Oro yanbal.jpg', NOW(), NOW(), NOW()),
('Ccori Rose', 'ccori-rose', 'COL-YB08', 'Rose Ccori with romantic pink florals and precious elegance.', 19, true, '/images/perfumes/Ccori Rose.jpg', NOW(), NOW(), NOW()),
('Cielo', 'cielo', 'COL-YB09', 'Heavenly women''s fragrance with sky-blue freshness and clouds.', 19, true, '/images/perfumes/Cielo yanbal.jpg', NOW(), NOW(), NOW()),
('Dendur', 'dendur', 'COL-YB10', 'Ancient-inspired men''s cologne with mysterious depth and power.', 19, true, '/images/perfumes/Dendur.jpg', NOW(), NOW(), NOW()),
('Dulce Amistad', 'dulce-amistad', 'COL-YB11', 'Sweet friendship splash with caring warmth and tender notes.', 19, true, '/images/perfumes/Dulce Amistad.jpg', NOW(), NOW(), NOW()),
('Evoluzion Hombre', 'evoluzion-hombre', 'COL-YB12', 'Evolution men''s fragrance with progressive modernity and growth.', 19, true, '/images/perfumes/Evoluzion Hombre.jpg', NOW(), NOW(), NOW()),
('Gaia', 'gaia', 'COL-YB13', 'Earth goddess women''s perfume with natural beauty and grounding.', 19, true, '/images/perfumes/Gaia.jpg', NOW(), NOW(), NOW()),
('Gaia Elixir', 'gaia-elixir', 'COL-YB14', 'Elixir of Gaia with concentrated earth essence and magic.', 19, true, '/images/perfumes/Gaia Elixir.jpg', NOW(), NOW(), NOW()),
('Icono Para Mujer', 'icono-para-mujer', 'COL-YB15', 'Iconic women''s fragrance with signature elegance and status.', 19, true, '/images/perfumes/Icono Para Mujer yanbal.jpg', NOW(), NOW(), NOW()),
('Liberatta', 'liberatta', 'COL-YB16', 'Liberated women''s scent with freedom independence and joy.', 19, true, '/images/perfumes/Liberatta yanbal.jpg', NOW(), NOW(), NOW()),
('L Essence', 'lessence', 'COL-YB17', 'Essential women''s fragrance with pure concentrated elegance.', 19, true, '/images/perfumes/L''Essence.jpg', NOW(), NOW(), NOW()),
('Musk Blanc', 'musk-blanc', 'COL-YB18', 'White musk women''s fragrance with clean softness and purity.', 19, true, '/images/perfumes/Musk Blanc.jpg', NOW(), NOW(), NOW()),
('Ohm Azul', 'ohm-azul', 'COL-YB19', 'Zen men''s cologne with meditative calm and spiritual balance.', 19, true, '/images/perfumes/Ohm Azul.jpeg', NOW(), NOW(), NOW()),
('Ohm Black', 'ohm-black', 'COL-YB20', 'Black Ohm with deeper meditation and powerful inner strength.', 19, true, '/images/perfumes/Ohm black.jpg', NOW(), NOW(), NOW()),
('Ohm Soul', 'ohm-soul', 'COL-YB21', 'Soul Ohm with spiritual depth and transcendent peace.', 19, true, '/images/perfumes/Ohm Soul.jpeg', NOW(), NOW(), NOW()),
('Osadia', 'osadia', 'COL-YB22', 'Bold women''s perfume with daring confidence and audacity.', 19, true, '/images/perfumes/Osadia yanbal.jpg', NOW(), NOW(), NOW()),
('Osadia Infinita', 'osadia-infinita', 'COL-YB23', 'Infinite boldness with endless courage and limitless daring.', 19, true, '/images/perfumes/Osadia Infinita.jpg', NOW(), NOW(), NOW()),
('Osadia Para Hombre', 'osadia-para-hombre', 'COL-YB24', 'Bold men''s cologne with masculine audacity and courage.', 19, true, '/images/perfumes/Osadia Para Hombre yanbal.jpg', NOW(), NOW(), NOW()),
('Solo', 'solo', 'COL-YB25', 'Solo men''s fragrance with independent character and self-assurance.', 19, true, '/images/perfumes/Solo.jpg', NOW(), NOW(), NOW()),
('Soy Cool', 'soy-cool', 'COL-YB26', 'Cool youthful scent with relaxed freshness and casual vibe.', 19, true, '/images/perfumes/Soy Cool.jpg', NOW(), NOW(), NOW()),
('Soy Sexy', 'soy-sexy', 'COL-YB27', 'Sexy youthful fragrance with attractive confidence and allure.', 19, true, '/images/perfumes/Soy Sexy.jpg', NOW(), NOW(), NOW()),
('Sprio Blue', 'sprio-blue', 'COL-YB28', 'Blue Sprio with fresh aquatic energy and cool vibrancy.', 19, true, '/images/perfumes/Sprio Blue.jpg', NOW(), NOW(), NOW()),
('Temptation Black Hombre', 'temptation-black-hombre', 'COL-YB29', 'Black temptation men''s with dark seduction and mystery.', 19, true, '/images/perfumes/Temptation Black Hombre yanbal.jpg', NOW(), NOW(), NOW()),
('Temptation Mujer', 'temptation-mujer', 'COL-YB30', 'Tempting women''s fragrance with irresistible seduction.', 19, true, '/images/perfumes/Temptation Mujer.jpg', NOW(), NOW(), NOW()),
('Temptation Para Hombre', 'temptation-para-hombre', 'COL-YB31', 'Tempting men''s cologne with masculine seduction and allure.', 19, true, '/images/perfumes/Temptation para hombre.jpg', NOW(), NOW(), NOW()),
('Viva Liberatta', 'viva-liberatta', 'COL-YB32', 'Lively liberated scent with joyful freedom and celebration.', 19, true, '/images/perfumes/Viva Liberatta.jpg', NOW(), NOW(), NOW()),
('Xool', 'xool', 'COL-YB33', 'Cool modern fragrance with fresh innovation and relaxed style.', 19, true, '/images/perfumes/Xool.jpg', NOW(), NOW(), NOW()),
('Zentro Para Hombre', 'zentro-para-hombre', 'COL-YB34', 'Centered men''s cologne with balanced harmony and focus.', 19, true, '/images/perfumes/Zentro Para Hombre yanbal.jpg', NOW(), NOW(), NOW());

-- Link products to category (perfume = 40)
INSERT INTO products_category_links (product_id, category_id)
SELECT id, 40 FROM products WHERE ref LIKE 'COL-%';

-- Get brand IDs and link products to brands
-- Avon products
INSERT INTO products_brand_links (product_id, brand_id)
SELECT p.id, b.id FROM products p, brands b WHERE p.ref LIKE 'COL-AV%' AND b.slug = 'avon';

-- Cyzone products
INSERT INTO products_brand_links (product_id, brand_id)
SELECT p.id, b.id FROM products p, brands b WHERE p.ref LIKE 'COL-CY%' AND b.slug = 'cyzone';

-- Esika products
INSERT INTO products_brand_links (product_id, brand_id)
SELECT p.id, b.id FROM products p, brands b WHERE p.ref LIKE 'COL-ES%' AND b.slug = 'esika';

-- L'Bel products
INSERT INTO products_brand_links (product_id, brand_id)
SELECT p.id, b.id FROM products p, brands b WHERE p.ref LIKE 'COL-LB%' AND b.slug = 'lbel';

-- Yanbal products
INSERT INTO products_brand_links (product_id, brand_id)
SELECT p.id, b.id FROM products p, brands b WHERE p.ref LIKE 'COL-YB%' AND b.slug = 'yanbal';
