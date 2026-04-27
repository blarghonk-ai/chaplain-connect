-- ============================================================
-- Migration 009 — Phase 12F: GRC Framework Control Seeding
--
-- Seeds controls for the 6 remaining frameworks:
--   ISO 27001:2022   (93 controls — Annex A, 4 themes)
--   ISO 27017:2015   (20 cloud-specific controls)
--   ISO 27018:2019   (25 PII in public cloud controls)
--   ISO 27701:2019   (49 PIMS privacy controls)
--   ISO 42001:2023   (38 AI management system controls)
--   FedRAMP Moderate (120 key NIST SP 800-53 Rev 5 controls)
--
-- Also seeds cross-framework mappings (SOC 2 ↔ ISO 27001 ↔ FedRAMP)
-- and auto-creates grc_implementations rows for all new controls.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ISO 27001:2022 — 93 controls across 4 themes
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'iso27001')
insert into grc_controls (framework_id, control_id, title, category) values
  -- Organizational controls (A.5) — 37 controls
  ((select id from fw), 'A.5.1',  'Policies for information security',                           'Organizational'),
  ((select id from fw), 'A.5.2',  'Information security roles and responsibilities',              'Organizational'),
  ((select id from fw), 'A.5.3',  'Segregation of duties',                                       'Organizational'),
  ((select id from fw), 'A.5.4',  'Management responsibilities',                                  'Organizational'),
  ((select id from fw), 'A.5.5',  'Contact with authorities',                                    'Organizational'),
  ((select id from fw), 'A.5.6',  'Contact with special interest groups',                        'Organizational'),
  ((select id from fw), 'A.5.7',  'Threat intelligence',                                         'Organizational'),
  ((select id from fw), 'A.5.8',  'Information security in project management',                  'Organizational'),
  ((select id from fw), 'A.5.9',  'Inventory of information and other associated assets',        'Organizational'),
  ((select id from fw), 'A.5.10', 'Acceptable use of information and other assets',              'Organizational'),
  ((select id from fw), 'A.5.11', 'Return of assets',                                            'Organizational'),
  ((select id from fw), 'A.5.12', 'Classification of information',                               'Organizational'),
  ((select id from fw), 'A.5.13', 'Labelling of information',                                    'Organizational'),
  ((select id from fw), 'A.5.14', 'Information transfer',                                        'Organizational'),
  ((select id from fw), 'A.5.15', 'Access control',                                              'Organizational'),
  ((select id from fw), 'A.5.16', 'Identity management',                                         'Organizational'),
  ((select id from fw), 'A.5.17', 'Authentication information',                                  'Organizational'),
  ((select id from fw), 'A.5.18', 'Access rights',                                               'Organizational'),
  ((select id from fw), 'A.5.19', 'Information security in supplier relationships',              'Organizational'),
  ((select id from fw), 'A.5.20', 'Addressing information security in supplier agreements',     'Organizational'),
  ((select id from fw), 'A.5.21', 'Managing information security in the ICT supply chain',      'Organizational'),
  ((select id from fw), 'A.5.22', 'Monitoring, review and change management of supplier services', 'Organizational'),
  ((select id from fw), 'A.5.23', 'Information security for use of cloud services',             'Organizational'),
  ((select id from fw), 'A.5.24', 'Information security incident management planning and preparation', 'Organizational'),
  ((select id from fw), 'A.5.25', 'Assessment and decision on information security events',     'Organizational'),
  ((select id from fw), 'A.5.26', 'Response to information security incidents',                 'Organizational'),
  ((select id from fw), 'A.5.27', 'Learning from information security incidents',               'Organizational'),
  ((select id from fw), 'A.5.28', 'Collection of evidence',                                     'Organizational'),
  ((select id from fw), 'A.5.29', 'Information security during disruption',                     'Organizational'),
  ((select id from fw), 'A.5.30', 'ICT readiness for business continuity',                      'Organizational'),
  ((select id from fw), 'A.5.31', 'Legal, statutory, regulatory and contractual requirements', 'Organizational'),
  ((select id from fw), 'A.5.32', 'Intellectual property rights',                               'Organizational'),
  ((select id from fw), 'A.5.33', 'Protection of records',                                      'Organizational'),
  ((select id from fw), 'A.5.34', 'Privacy and protection of PII',                              'Organizational'),
  ((select id from fw), 'A.5.35', 'Independent review of information security',                 'Organizational'),
  ((select id from fw), 'A.5.36', 'Compliance with policies, rules and standards for information security', 'Organizational'),
  ((select id from fw), 'A.5.37', 'Documented operating procedures',                            'Organizational'),
  -- People controls (A.6) — 8 controls
  ((select id from fw), 'A.6.1',  'Screening',                                                   'People'),
  ((select id from fw), 'A.6.2',  'Terms and conditions of employment',                          'People'),
  ((select id from fw), 'A.6.3',  'Information security awareness, education and training',      'People'),
  ((select id from fw), 'A.6.4',  'Disciplinary process',                                        'People'),
  ((select id from fw), 'A.6.5',  'Responsibilities after termination or change of employment', 'People'),
  ((select id from fw), 'A.6.6',  'Confidentiality or non-disclosure agreements',               'People'),
  ((select id from fw), 'A.6.7',  'Remote working',                                              'People'),
  ((select id from fw), 'A.6.8',  'Information security event reporting',                        'People'),
  -- Physical controls (A.7) — 14 controls
  ((select id from fw), 'A.7.1',  'Physical security perimeters',                                'Physical'),
  ((select id from fw), 'A.7.2',  'Physical entry',                                              'Physical'),
  ((select id from fw), 'A.7.3',  'Securing offices, rooms and facilities',                      'Physical'),
  ((select id from fw), 'A.7.4',  'Physical security monitoring',                                'Physical'),
  ((select id from fw), 'A.7.5',  'Protecting against physical and environmental threats',      'Physical'),
  ((select id from fw), 'A.7.6',  'Working in secure areas',                                    'Physical'),
  ((select id from fw), 'A.7.7',  'Clear desk and clear screen',                                'Physical'),
  ((select id from fw), 'A.7.8',  'Equipment siting and protection',                            'Physical'),
  ((select id from fw), 'A.7.9',  'Security of assets off-premises',                            'Physical'),
  ((select id from fw), 'A.7.10', 'Storage media',                                               'Physical'),
  ((select id from fw), 'A.7.11', 'Supporting utilities',                                        'Physical'),
  ((select id from fw), 'A.7.12', 'Cabling security',                                            'Physical'),
  ((select id from fw), 'A.7.13', 'Equipment maintenance',                                       'Physical'),
  ((select id from fw), 'A.7.14', 'Secure disposal or re-use of equipment',                     'Physical'),
  -- Technological controls (A.8) — 34 controls
  ((select id from fw), 'A.8.1',  'User endpoint devices',                                       'Technological'),
  ((select id from fw), 'A.8.2',  'Privileged access rights',                                    'Technological'),
  ((select id from fw), 'A.8.3',  'Information access restriction',                              'Technological'),
  ((select id from fw), 'A.8.4',  'Access to source code',                                       'Technological'),
  ((select id from fw), 'A.8.5',  'Secure authentication',                                       'Technological'),
  ((select id from fw), 'A.8.6',  'Capacity management',                                         'Technological'),
  ((select id from fw), 'A.8.7',  'Protection against malware',                                  'Technological'),
  ((select id from fw), 'A.8.8',  'Management of technical vulnerabilities',                     'Technological'),
  ((select id from fw), 'A.8.9',  'Configuration management',                                    'Technological'),
  ((select id from fw), 'A.8.10', 'Information deletion',                                        'Technological'),
  ((select id from fw), 'A.8.11', 'Data masking',                                                'Technological'),
  ((select id from fw), 'A.8.12', 'Data leakage prevention',                                     'Technological'),
  ((select id from fw), 'A.8.13', 'Information backup',                                          'Technological'),
  ((select id from fw), 'A.8.14', 'Redundancy of information processing facilities',            'Technological'),
  ((select id from fw), 'A.8.15', 'Logging',                                                     'Technological'),
  ((select id from fw), 'A.8.16', 'Monitoring activities',                                       'Technological'),
  ((select id from fw), 'A.8.17', 'Clock synchronization',                                       'Technological'),
  ((select id from fw), 'A.8.18', 'Use of privileged utility programs',                          'Technological'),
  ((select id from fw), 'A.8.19', 'Installation of software on operational systems',             'Technological'),
  ((select id from fw), 'A.8.20', 'Networks security',                                           'Technological'),
  ((select id from fw), 'A.8.21', 'Security of network services',                                'Technological'),
  ((select id from fw), 'A.8.22', 'Segregation of networks',                                     'Technological'),
  ((select id from fw), 'A.8.23', 'Web filtering',                                               'Technological'),
  ((select id from fw), 'A.8.24', 'Use of cryptography',                                         'Technological'),
  ((select id from fw), 'A.8.25', 'Secure development life cycle',                               'Technological'),
  ((select id from fw), 'A.8.26', 'Application security requirements',                           'Technological'),
  ((select id from fw), 'A.8.27', 'Secure system architecture and engineering principles',      'Technological'),
  ((select id from fw), 'A.8.28', 'Secure coding',                                               'Technological'),
  ((select id from fw), 'A.8.29', 'Security testing in development and acceptance',             'Technological'),
  ((select id from fw), 'A.8.30', 'Outsourced development',                                      'Technological'),
  ((select id from fw), 'A.8.31', 'Separation of development, test and production environments','Technological'),
  ((select id from fw), 'A.8.32', 'Change management',                                           'Technological'),
  ((select id from fw), 'A.8.33', 'Test information',                                            'Technological'),
  ((select id from fw), 'A.8.34', 'Protection of information systems during audit testing',     'Technological')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- ISO 27017:2015 — Cloud security controls
-- Includes 8 new cloud-specific controls (CLD.*) plus
-- key cloud-applicable guidance controls
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'iso27017')
insert into grc_controls (framework_id, control_id, title, category) values
  -- 8 unique cloud-specific controls
  ((select id from fw), 'CLD.6.3.1',  'Shared roles and responsibilities within a cloud computing environment', 'Cloud Governance'),
  ((select id from fw), 'CLD.8.1.5',  'Removal or return of cloud assets',                                     'Cloud Governance'),
  ((select id from fw), 'CLD.9.5.1',  'Segregation in virtual computing environments',                         'Cloud Infrastructure'),
  ((select id from fw), 'CLD.9.5.2',  'Virtual machine hardening',                                             'Cloud Infrastructure'),
  ((select id from fw), 'CLD.12.1.5', 'Administrator''s operational security',                                 'Cloud Operations'),
  ((select id from fw), 'CLD.12.4.5', 'Monitoring of cloud services',                                          'Cloud Operations'),
  ((select id from fw), 'CLD.13.1.4', 'Alignment of security management for virtual and physical networks',    'Cloud Networking'),
  ((select id from fw), 'CLD.16.1.3', 'Response to cloud security incidents',                                  'Cloud Incident Response'),
  -- Cloud-applicable guidance controls (cloud context of ISO 27001 controls)
  ((select id from fw), 'CLD.A.5.23', 'Information security for use of cloud services — governance',           'Cloud Governance'),
  ((select id from fw), 'CLD.A.5.19', 'Supplier security policy for cloud providers',                          'Cloud Governance'),
  ((select id from fw), 'CLD.A.5.20', 'Cloud provider contractual security requirements',                      'Cloud Governance'),
  ((select id from fw), 'CLD.A.8.5',  'Secure authentication for cloud services',                              'Cloud Access'),
  ((select id from fw), 'CLD.A.8.2',  'Privileged access rights in cloud environments',                       'Cloud Access'),
  ((select id from fw), 'CLD.A.5.15', 'Access control policy for cloud resources',                             'Cloud Access'),
  ((select id from fw), 'CLD.A.8.24', 'Cryptography for data in transit and at rest (cloud)',                  'Cloud Data'),
  ((select id from fw), 'CLD.A.8.10', 'Secure data deletion from cloud storage',                               'Cloud Data'),
  ((select id from fw), 'CLD.A.8.13', 'Cloud backup and recovery',                                             'Cloud Operations'),
  ((select id from fw), 'CLD.A.8.14', 'Redundancy and availability of cloud services',                         'Cloud Operations'),
  ((select id from fw), 'CLD.A.8.15', 'Logging and monitoring in cloud environments',                          'Cloud Operations'),
  ((select id from fw), 'CLD.A.8.25', 'Secure development life cycle in cloud-native context',                 'Cloud Development')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- ISO 27018:2019 — Protection of PII in Public Cloud (25 controls)
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'iso27018')
insert into grc_controls (framework_id, control_id, title, category) values
  ((select id from fw), 'P.1',  'Consent and choice for PII processing',                              'PII Principles'),
  ((select id from fw), 'P.2',  'Purpose legitimacy and specification',                               'PII Principles'),
  ((select id from fw), 'P.3',  'Collection limitation',                                              'PII Principles'),
  ((select id from fw), 'P.4',  'Data minimisation',                                                  'PII Principles'),
  ((select id from fw), 'P.5',  'Use, retention and disclosure limitation',                           'PII Principles'),
  ((select id from fw), 'P.6',  'Accuracy and quality',                                               'PII Principles'),
  ((select id from fw), 'P.7',  'Openness, transparency and notice',                                  'PII Principles'),
  ((select id from fw), 'P.8',  'Individual participation and access',                                'PII Principles'),
  ((select id from fw), 'P.9',  'Accountability for PII processing',                                  'PII Principles'),
  ((select id from fw), 'P.10', 'Information security controls for PII',                              'PII Principles'),
  ((select id from fw), 'P.11', 'Privacy compliance',                                                 'PII Principles'),
  ((select id from fw), 'A.1',  'Prohibition on use of PII for marketing or advertising',            'Cloud PII Controls'),
  ((select id from fw), 'A.2',  'Responding to public cloud PII principal requests',                  'Cloud PII Controls'),
  ((select id from fw), 'A.3',  'Obligations to PII principals for sub-contractors',                 'Cloud PII Controls'),
  ((select id from fw), 'A.4',  'Records of disclosure of PII to third parties',                     'Cloud PII Controls'),
  ((select id from fw), 'A.5',  'Notification of PII data breach',                                   'Cloud PII Controls'),
  ((select id from fw), 'A.6',  'Anonymised data use for statistics',                                'Cloud PII Controls'),
  ((select id from fw), 'A.7',  'Temporary files containing PII',                                    'Cloud PII Controls'),
  ((select id from fw), 'A.8',  'Policy for return, transfer or disposal of PII',                   'Cloud PII Controls'),
  ((select id from fw), 'A.9',  'PII geo-location restrictions',                                     'Cloud PII Controls'),
  ((select id from fw), 'A.10', 'Correction and erasure of PII',                                     'Cloud PII Controls'),
  ((select id from fw), 'A.11', 'Logging activity of cloud service administrators',                  'Cloud PII Controls'),
  ((select id from fw), 'A.12', 'Unique identifiers for customer administrators',                    'Cloud PII Controls'),
  ((select id from fw), 'A.13', 'Disclosure of sub-processors used',                                 'Cloud PII Controls'),
  ((select id from fw), 'A.14', 'Contracts with sub-processors for PII protection',                 'Cloud PII Controls')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- ISO 27701:2019 — Privacy Information Management System (49 controls)
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'iso27701')
insert into grc_controls (framework_id, control_id, title, category) values
  -- Controller-specific controls (Clause 6)
  ((select id from fw), '6.2.1',  'Identify and document purpose for processing PII',                    'Controller — Collection'),
  ((select id from fw), '6.2.2',  'Identify lawful basis for processing PII',                            'Controller — Collection'),
  ((select id from fw), '6.2.3',  'Determine when and how consent is obtained',                          'Controller — Collection'),
  ((select id from fw), '6.2.4',  'Obtain and record consent',                                           'Controller — Collection'),
  ((select id from fw), '6.2.5',  'Privacy impact assessment',                                           'Controller — Collection'),
  ((select id from fw), '6.3.1',  'Provide privacy notice to PII principals',                            'Controller — Obligations'),
  ((select id from fw), '6.3.2',  'Provide information to PII principals on collection',                 'Controller — Obligations'),
  ((select id from fw), '6.3.3',  'Provide mechanism to modify or withdraw consent',                     'Controller — Obligations'),
  ((select id from fw), '6.3.4',  'Provide access to PII data upon request',                             'Controller — Obligations'),
  ((select id from fw), '6.3.5',  'Rectification of inaccurate PII',                                     'Controller — Obligations'),
  ((select id from fw), '6.3.6',  'Erasure of PII (right to be forgotten)',                              'Controller — Obligations'),
  ((select id from fw), '6.3.7',  'Data portability',                                                    'Controller — Obligations'),
  ((select id from fw), '6.3.8',  'Objection to processing',                                             'Controller — Obligations'),
  ((select id from fw), '6.3.9',  'Automated decision-making',                                           'Controller — Obligations'),
  ((select id from fw), '6.4.1',  'Limit collection to stated purpose',                                  'Controller — Privacy by Design'),
  ((select id from fw), '6.4.2',  'Limit processing to identified purposes',                             'Controller — Privacy by Design'),
  ((select id from fw), '6.4.3',  'Accuracy and quality of PII',                                         'Controller — Privacy by Design'),
  ((select id from fw), '6.4.4',  'Minimise processing',                                                 'Controller — Privacy by Design'),
  ((select id from fw), '6.4.5',  'Retention of PII limited to stated purpose',                          'Controller — Privacy by Design'),
  ((select id from fw), '6.4.6',  'Restrict processing on request of PII principal',                     'Controller — Privacy by Design'),
  ((select id from fw), '6.4.7',  'Temporary files containing PII',                                      'Controller — Privacy by Design'),
  ((select id from fw), '6.4.8',  'Privacy by default',                                                  'Controller — Privacy by Design'),
  ((select id from fw), '6.5.1',  'Identify basis for PII transfer to third country',                   'Controller — Transfer'),
  ((select id from fw), '6.5.2',  'Countries and international organisations to which PII can be transferred', 'Controller — Transfer'),
  ((select id from fw), '6.5.3',  'Records of PII disclosure to third parties',                          'Controller — Transfer'),
  ((select id from fw), '6.5.4',  'Notification of PII disclosure requests',                             'Controller — Transfer'),
  ((select id from fw), '6.5.5',  'Disclosure of sub-processors',                                        'Controller — Transfer'),
  ((select id from fw), '6.5.6',  'Contractual agreements with PII processors',                          'Controller — Transfer'),
  -- Processor-specific controls (Clause 7)
  ((select id from fw), '7.2.1',  'Determine roles and responsibilities (processor)',                    'Processor — Collection'),
  ((select id from fw), '7.2.2',  'Organisation purpose and applicable legislation (processor)',         'Processor — Collection'),
  ((select id from fw), '7.2.3',  'PII inventory (processor)',                                           'Processor — Collection'),
  ((select id from fw), '7.2.4',  'Determine lawful basis for processing (processor)',                  'Processor — Collection'),
  ((select id from fw), '7.3.1',  'Obligations to PII principals (processor)',                           'Processor — Obligations'),
  ((select id from fw), '7.3.2',  'Determining information for PII principals (processor)',              'Processor — Obligations'),
  ((select id from fw), '7.3.3',  'Providing information to PII principals (processor)',                 'Processor — Obligations'),
  ((select id from fw), '7.4.1',  'Privacy by design for processor',                                     'Processor — Privacy by Design'),
  ((select id from fw), '7.4.2',  'Temporary files — processor',                                         'Processor — Privacy by Design'),
  ((select id from fw), '7.4.3',  'PII transmission controls',                                           'Processor — Privacy by Design'),
  ((select id from fw), '7.4.4',  'PII disclosure to third parties',                                     'Processor — Privacy by Design'),
  ((select id from fw), '7.4.5',  'Sharing PII with third parties',                                      'Processor — Privacy by Design'),
  ((select id from fw), '7.4.6',  'Disclosure of sub-processors to controller',                          'Processor — Privacy by Design'),
  ((select id from fw), '7.4.7',  'Engagement of sub-processors',                                        'Processor — Privacy by Design'),
  ((select id from fw), '7.4.8',  'Requests from PII principals to sub-processors',                      'Processor — Privacy by Design'),
  ((select id from fw), '7.5.1',  'Basis for transfer of PII (processor)',                               'Processor — Transfer'),
  ((select id from fw), '7.5.2',  'Countries and international organisations — processor',               'Processor — Transfer'),
  -- Extended ISO 27001 controls for privacy (Clause 8 additions)
  ((select id from fw), '8.2.1',  'ISMS scope with privacy considerations',                              'PIMS — ISMS Integration'),
  ((select id from fw), '8.2.2',  'Privacy risk assessment and treatment',                               'PIMS — ISMS Integration'),
  ((select id from fw), '8.4.1',  'Communication of privacy policy to interested parties',               'PIMS — ISMS Integration'),
  ((select id from fw), '8.5.1',  'Documented information for PIMS',                                     'PIMS — ISMS Integration')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- ISO 42001:2023 — AI Management System (38 controls)
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'iso42001')
insert into grc_controls (framework_id, control_id, title, category) values
  -- Clause 5: Leadership
  ((select id from fw), '5.1',   'Leadership and commitment to AI management',                      'Leadership'),
  ((select id from fw), '5.2',   'AI policy',                                                       'Leadership'),
  ((select id from fw), '5.3',   'Organizational roles, responsibilities and authorities for AI',  'Leadership'),
  -- Clause 6: Planning
  ((select id from fw), '6.1.1', 'Actions to address AI risks and opportunities',                  'Planning'),
  ((select id from fw), '6.1.2', 'AI risk assessment process',                                      'Planning'),
  ((select id from fw), '6.1.3', 'AI risk treatment',                                               'Planning'),
  ((select id from fw), '6.2',   'AI objectives and planning to achieve them',                      'Planning'),
  -- Clause 7: Support
  ((select id from fw), '7.1',   'Resources for AI management',                                     'Support'),
  ((select id from fw), '7.2',   'Competence for AI systems',                                       'Support'),
  ((select id from fw), '7.3',   'Awareness of AI risks and responsible use',                       'Support'),
  ((select id from fw), '7.4',   'Communication about AI systems',                                  'Support'),
  ((select id from fw), '7.5',   'Documented information for AI management',                        'Support'),
  -- Clause 8: Operation
  ((select id from fw), '8.2',   'AI risk assessment',                                              'Operation'),
  ((select id from fw), '8.3',   'AI risk treatment',                                               'Operation'),
  ((select id from fw), '8.4',   'AI system impact assessment',                                     'Operation'),
  -- Clause 9: Performance evaluation
  ((select id from fw), '9.1',   'Monitoring, measurement, analysis and evaluation of AI',         'Evaluation'),
  ((select id from fw), '9.2',   'Internal audit of AI management system',                          'Evaluation'),
  ((select id from fw), '9.3',   'Management review of AI management system',                       'Evaluation'),
  -- Clause 10: Improvement
  ((select id from fw), '10.1',  'Continual improvement of AI management',                          'Improvement'),
  ((select id from fw), '10.2',  'Nonconformity and corrective action (AI)',                        'Improvement'),
  -- Annex A controls
  ((select id from fw), 'A.2.1', 'Policies related to AI',                                          'AI Policy'),
  ((select id from fw), 'A.2.2', 'Responsible AI and ethical principles',                            'AI Policy'),
  ((select id from fw), 'A.2.3', 'Roles related to AI within the organization',                     'AI Policy'),
  ((select id from fw), 'A.3.1', 'Internal organization for AI',                                    'AI Governance'),
  ((select id from fw), 'A.3.2', 'Reporting obligations for AI incidents',                          'AI Governance'),
  ((select id from fw), 'A.3.3', 'AI systems management with third parties',                        'AI Governance'),
  ((select id from fw), 'A.4.1', 'AI-specific resources (compute, data, models)',                   'AI Resources'),
  ((select id from fw), 'A.4.2', 'Allocation of resources across AI life cycle',                    'AI Resources'),
  ((select id from fw), 'A.5.1', 'Risk and impact assessment of AI systems',                        'AI Risk'),
  ((select id from fw), 'A.5.2', 'Documentation of AI systems (model cards)',                       'AI Risk'),
  ((select id from fw), 'A.6.1', 'AI system design and specifications',                             'AI Life Cycle'),
  ((select id from fw), 'A.6.2', 'AI system data acquisition and labelling',                        'AI Life Cycle'),
  ((select id from fw), 'A.6.3', 'AI system testing and validation',                                'AI Life Cycle'),
  ((select id from fw), 'A.6.4', 'AI system deployment and monitoring',                             'AI Life Cycle'),
  ((select id from fw), 'A.7.1', 'Data governance for AI training and inference',                   'AI Data'),
  ((select id from fw), 'A.7.2', 'Data quality and provenance for AI',                              'AI Data'),
  ((select id from fw), 'A.8.1', 'Transparency communications about AI use',                        'AI Transparency'),
  ((select id from fw), 'A.9.1', 'Responsible use of AI systems by third parties',                  'AI Third Parties')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- FedRAMP Moderate — NIST SP 800-53 Rev 5 (key controls, 18 families)
-- ─────────────────────────────────────────────────────────────

with fw as (select id from grc_frameworks where key = 'fedramp')
insert into grc_controls (framework_id, control_id, title, category) values
  -- AC — Access Control
  ((select id from fw), 'AC-1',      'Access Control Policy and Procedures',                   'Access Control'),
  ((select id from fw), 'AC-2',      'Account Management',                                     'Access Control'),
  ((select id from fw), 'AC-2(1)',   'Account Management — Automated System Account Management','Access Control'),
  ((select id from fw), 'AC-2(3)',   'Account Management — Disable Accounts',                  'Access Control'),
  ((select id from fw), 'AC-2(4)',   'Account Management — Automated Audit Actions',           'Access Control'),
  ((select id from fw), 'AC-3',      'Access Enforcement',                                     'Access Control'),
  ((select id from fw), 'AC-4',      'Information Flow Enforcement',                           'Access Control'),
  ((select id from fw), 'AC-5',      'Separation of Duties',                                   'Access Control'),
  ((select id from fw), 'AC-6',      'Least Privilege',                                        'Access Control'),
  ((select id from fw), 'AC-6(1)',   'Least Privilege — Authorize Access to Security Functions','Access Control'),
  ((select id from fw), 'AC-6(2)',   'Least Privilege — Non-Privileged Access for Non-Security Functions', 'Access Control'),
  ((select id from fw), 'AC-6(5)',   'Least Privilege — Privileged Accounts',                  'Access Control'),
  ((select id from fw), 'AC-6(9)',   'Least Privilege — Log Use of Privileged Functions',      'Access Control'),
  ((select id from fw), 'AC-7',      'Unsuccessful Logon Attempts',                            'Access Control'),
  ((select id from fw), 'AC-8',      'System Use Notification',                                'Access Control'),
  ((select id from fw), 'AC-11',     'Device Lock',                                            'Access Control'),
  ((select id from fw), 'AC-12',     'Session Termination',                                    'Access Control'),
  ((select id from fw), 'AC-14',     'Permitted Actions Without Identification or Authentication', 'Access Control'),
  ((select id from fw), 'AC-17',     'Remote Access',                                          'Access Control'),
  ((select id from fw), 'AC-17(1)',  'Remote Access — Monitoring and Control',                 'Access Control'),
  ((select id from fw), 'AC-17(2)',  'Remote Access — Protection of Confidentiality and Integrity', 'Access Control'),
  ((select id from fw), 'AC-18',     'Wireless Access',                                        'Access Control'),
  ((select id from fw), 'AC-19',     'Access Control for Mobile Devices',                      'Access Control'),
  ((select id from fw), 'AC-20',     'Use of External Systems',                                'Access Control'),
  ((select id from fw), 'AC-22',     'Publicly Accessible Content',                            'Access Control'),
  -- AT — Awareness and Training
  ((select id from fw), 'AT-1',      'Awareness and Training Policy and Procedures',           'Awareness & Training'),
  ((select id from fw), 'AT-2',      'Literacy Training and Awareness',                        'Awareness & Training'),
  ((select id from fw), 'AT-2(2)',   'Literacy Training — Insider Threat',                     'Awareness & Training'),
  ((select id from fw), 'AT-3',      'Role-Based Training',                                    'Awareness & Training'),
  ((select id from fw), 'AT-4',      'Training Records',                                       'Awareness & Training'),
  -- AU — Audit and Accountability
  ((select id from fw), 'AU-1',      'Audit and Accountability Policy and Procedures',         'Audit & Accountability'),
  ((select id from fw), 'AU-2',      'Event Logging',                                          'Audit & Accountability'),
  ((select id from fw), 'AU-3',      'Content of Audit Records',                               'Audit & Accountability'),
  ((select id from fw), 'AU-3(1)',   'Content of Audit Records — Additional Audit Information','Audit & Accountability'),
  ((select id from fw), 'AU-4',      'Audit Log Storage Capacity',                             'Audit & Accountability'),
  ((select id from fw), 'AU-5',      'Response to Audit Logging Process Failures',             'Audit & Accountability'),
  ((select id from fw), 'AU-6',      'Audit Record Review, Analysis, and Reporting',           'Audit & Accountability'),
  ((select id from fw), 'AU-6(1)',   'Audit Record Review — Automated Process Integration',   'Audit & Accountability'),
  ((select id from fw), 'AU-7',      'Audit Record Reduction and Report Generation',           'Audit & Accountability'),
  ((select id from fw), 'AU-8',      'Time Stamps',                                            'Audit & Accountability'),
  ((select id from fw), 'AU-9',      'Protection of Audit Information',                        'Audit & Accountability'),
  ((select id from fw), 'AU-11',     'Audit Record Retention',                                 'Audit & Accountability'),
  ((select id from fw), 'AU-12',     'Audit Record Generation',                                'Audit & Accountability'),
  -- CA — Assessment, Authorization, and Monitoring
  ((select id from fw), 'CA-1',      'Assessment, Authorization, and Monitoring Policy',      'CA&M'),
  ((select id from fw), 'CA-2',      'Control Assessments',                                   'CA&M'),
  ((select id from fw), 'CA-2(1)',   'Control Assessments — Independent Assessors',           'CA&M'),
  ((select id from fw), 'CA-3',      'Information Exchange',                                  'CA&M'),
  ((select id from fw), 'CA-5',      'Plan of Action and Milestones',                         'CA&M'),
  ((select id from fw), 'CA-6',      'Authorization',                                         'CA&M'),
  ((select id from fw), 'CA-7',      'Continuous Monitoring',                                 'CA&M'),
  ((select id from fw), 'CA-7(1)',   'Continuous Monitoring — Independent Assessment',        'CA&M'),
  ((select id from fw), 'CA-8',      'Penetration Testing',                                   'CA&M'),
  ((select id from fw), 'CA-9',      'Internal System Connections',                            'CA&M'),
  -- CM — Configuration Management
  ((select id from fw), 'CM-1',      'Configuration Management Policy and Procedures',        'Configuration Management'),
  ((select id from fw), 'CM-2',      'Baseline Configuration',                                'Configuration Management'),
  ((select id from fw), 'CM-2(1)',   'Baseline Configuration — Reviews and Updates',          'Configuration Management'),
  ((select id from fw), 'CM-2(2)',   'Baseline Configuration — Automation Support',           'Configuration Management'),
  ((select id from fw), 'CM-3',      'Configuration Change Control',                          'Configuration Management'),
  ((select id from fw), 'CM-4',      'Impact Analyses',                                       'Configuration Management'),
  ((select id from fw), 'CM-5',      'Access Restrictions for Change',                        'Configuration Management'),
  ((select id from fw), 'CM-6',      'Configuration Settings',                                'Configuration Management'),
  ((select id from fw), 'CM-7',      'Least Functionality',                                   'Configuration Management'),
  ((select id from fw), 'CM-7(1)',   'Least Functionality — Periodic Review',                 'Configuration Management'),
  ((select id from fw), 'CM-8',      'System Component Inventory',                            'Configuration Management'),
  ((select id from fw), 'CM-9',      'Configuration Management Plan',                         'Configuration Management'),
  ((select id from fw), 'CM-10',     'Software Usage Restrictions',                           'Configuration Management'),
  ((select id from fw), 'CM-11',     'User-Installed Software',                               'Configuration Management'),
  -- CP — Contingency Planning
  ((select id from fw), 'CP-1',      'Contingency Planning Policy and Procedures',            'Contingency Planning'),
  ((select id from fw), 'CP-2',      'Contingency Plan',                                      'Contingency Planning'),
  ((select id from fw), 'CP-2(1)',   'Contingency Plan — Coordinate with Related Plans',      'Contingency Planning'),
  ((select id from fw), 'CP-3',      'Contingency Training',                                  'Contingency Planning'),
  ((select id from fw), 'CP-4',      'Contingency Plan Testing',                              'Contingency Planning'),
  ((select id from fw), 'CP-6',      'Alternate Storage Site',                                'Contingency Planning'),
  ((select id from fw), 'CP-7',      'Alternate Processing Site',                             'Contingency Planning'),
  ((select id from fw), 'CP-8',      'Telecommunications Services',                           'Contingency Planning'),
  ((select id from fw), 'CP-9',      'System Backup',                                         'Contingency Planning'),
  ((select id from fw), 'CP-9(1)',   'System Backup — Testing for Reliability and Integrity', 'Contingency Planning'),
  ((select id from fw), 'CP-10',     'System Recovery and Reconstitution',                    'Contingency Planning'),
  -- IA — Identification and Authentication
  ((select id from fw), 'IA-1',      'Identification and Authentication Policy',              'Identification & Auth'),
  ((select id from fw), 'IA-2',      'Identification and Authentication (Organizational Users)','Identification & Auth'),
  ((select id from fw), 'IA-2(1)',   'MFA — Privileged Accounts',                             'Identification & Auth'),
  ((select id from fw), 'IA-2(2)',   'MFA — Non-Privileged Accounts',                         'Identification & Auth'),
  ((select id from fw), 'IA-2(12)',  'Acceptance of PIV Credentials',                         'Identification & Auth'),
  ((select id from fw), 'IA-3',      'Device Identification and Authentication',              'Identification & Auth'),
  ((select id from fw), 'IA-4',      'Identifier Management',                                 'Identification & Auth'),
  ((select id from fw), 'IA-5',      'Authenticator Management',                              'Identification & Auth'),
  ((select id from fw), 'IA-5(1)',   'Authenticator Management — Password-Based Authentication','Identification & Auth'),
  ((select id from fw), 'IA-6',      'Authentication Feedback',                               'Identification & Auth'),
  ((select id from fw), 'IA-7',      'Cryptographic Module Authentication',                   'Identification & Auth'),
  ((select id from fw), 'IA-8',      'Identification and Authentication (Non-Organizational Users)', 'Identification & Auth'),
  ((select id from fw), 'IA-11',     'Re-Authentication',                                     'Identification & Auth'),
  ((select id from fw), 'IA-12',     'Identity Proofing',                                     'Identification & Auth'),
  -- IR — Incident Response
  ((select id from fw), 'IR-1',      'Incident Response Policy and Procedures',               'Incident Response'),
  ((select id from fw), 'IR-2',      'Incident Response Training',                            'Incident Response'),
  ((select id from fw), 'IR-3',      'Incident Response Testing',                             'Incident Response'),
  ((select id from fw), 'IR-4',      'Incident Handling',                                     'Incident Response'),
  ((select id from fw), 'IR-4(1)',   'Incident Handling — Automated Incident Handling Processes', 'Incident Response'),
  ((select id from fw), 'IR-5',      'Incident Monitoring',                                   'Incident Response'),
  ((select id from fw), 'IR-6',      'Incident Reporting',                                    'Incident Response'),
  ((select id from fw), 'IR-6(1)',   'Incident Reporting — Automated Reporting',              'Incident Response'),
  ((select id from fw), 'IR-7',      'Incident Response Assistance',                          'Incident Response'),
  ((select id from fw), 'IR-8',      'Incident Response Plan',                                'Incident Response'),
  -- MA — Maintenance
  ((select id from fw), 'MA-1',      'Maintenance Policy and Procedures',                     'Maintenance'),
  ((select id from fw), 'MA-2',      'Controlled Maintenance',                                'Maintenance'),
  ((select id from fw), 'MA-3',      'Maintenance Tools',                                     'Maintenance'),
  ((select id from fw), 'MA-4',      'Nonlocal Maintenance',                                  'Maintenance'),
  ((select id from fw), 'MA-5',      'Maintenance Personnel',                                 'Maintenance'),
  -- MP — Media Protection
  ((select id from fw), 'MP-1',      'Media Protection Policy and Procedures',                'Media Protection'),
  ((select id from fw), 'MP-2',      'Media Access',                                          'Media Protection'),
  ((select id from fw), 'MP-3',      'Media Marking',                                         'Media Protection'),
  ((select id from fw), 'MP-4',      'Media Storage',                                         'Media Protection'),
  ((select id from fw), 'MP-5',      'Media Transport',                                       'Media Protection'),
  ((select id from fw), 'MP-6',      'Media Sanitization',                                    'Media Protection'),
  ((select id from fw), 'MP-7',      'Media Use',                                             'Media Protection'),
  -- PE — Physical and Environmental Protection
  ((select id from fw), 'PE-1',      'Physical and Environmental Protection Policy',          'Physical & Environmental'),
  ((select id from fw), 'PE-2',      'Physical Access Authorizations',                        'Physical & Environmental'),
  ((select id from fw), 'PE-3',      'Physical Access Control',                               'Physical & Environmental'),
  ((select id from fw), 'PE-6',      'Monitoring Physical Access',                            'Physical & Environmental'),
  ((select id from fw), 'PE-8',      'Visitor Access Records',                                'Physical & Environmental'),
  ((select id from fw), 'PE-9',      'Power Equipment and Cabling',                           'Physical & Environmental'),
  ((select id from fw), 'PE-10',     'Emergency Shutoff',                                     'Physical & Environmental'),
  ((select id from fw), 'PE-11',     'Emergency Power',                                       'Physical & Environmental'),
  ((select id from fw), 'PE-12',     'Emergency Lighting',                                    'Physical & Environmental'),
  ((select id from fw), 'PE-13',     'Fire Protection',                                       'Physical & Environmental'),
  ((select id from fw), 'PE-14',     'Environmental Controls',                                'Physical & Environmental'),
  ((select id from fw), 'PE-15',     'Water Damage Protection',                               'Physical & Environmental'),
  ((select id from fw), 'PE-16',     'Delivery and Removal',                                  'Physical & Environmental'),
  ((select id from fw), 'PE-17',     'Alternate Work Site',                                   'Physical & Environmental'),
  -- PL — Planning
  ((select id from fw), 'PL-1',      'Planning Policy and Procedures',                        'Planning'),
  ((select id from fw), 'PL-2',      'System Security and Privacy Plans',                     'Planning'),
  ((select id from fw), 'PL-4',      'Rules of Behavior',                                     'Planning'),
  ((select id from fw), 'PL-8',      'Security and Privacy Architectures',                    'Planning'),
  ((select id from fw), 'PL-10',     'Baseline Selection',                                    'Planning'),
  ((select id from fw), 'PL-11',     'Baseline Tailoring',                                    'Planning'),
  -- PS — Personnel Security
  ((select id from fw), 'PS-1',      'Personnel Security Policy and Procedures',              'Personnel Security'),
  ((select id from fw), 'PS-2',      'Position Risk Designation',                             'Personnel Security'),
  ((select id from fw), 'PS-3',      'Personnel Screening',                                   'Personnel Security'),
  ((select id from fw), 'PS-4',      'Personnel Termination',                                 'Personnel Security'),
  ((select id from fw), 'PS-5',      'Personnel Transfer',                                    'Personnel Security'),
  ((select id from fw), 'PS-6',      'Access Agreements',                                     'Personnel Security'),
  ((select id from fw), 'PS-7',      'External Personnel Security',                           'Personnel Security'),
  ((select id from fw), 'PS-8',      'Personnel Sanctions',                                   'Personnel Security'),
  ((select id from fw), 'PS-9',      'Position Descriptions',                                 'Personnel Security'),
  -- PT — PII Processing and Transparency (Rev 5)
  ((select id from fw), 'PT-1',      'PII Processing and Transparency Policy',                'PII Transparency'),
  ((select id from fw), 'PT-2',      'Authority to Process PII',                              'PII Transparency'),
  ((select id from fw), 'PT-3',      'Personally Identifiable Information Minimization',      'PII Transparency'),
  ((select id from fw), 'PT-4',      'Consent',                                               'PII Transparency'),
  ((select id from fw), 'PT-5',      'Privacy Notice',                                        'PII Transparency'),
  ((select id from fw), 'PT-6',      'System of Records Notice',                              'PII Transparency'),
  ((select id from fw), 'PT-7',      'Specific Categories of PII',                            'PII Transparency'),
  ((select id from fw), 'PT-8',      'Computer Matching Requirements',                        'PII Transparency'),
  -- RA — Risk Assessment
  ((select id from fw), 'RA-1',      'Risk Assessment Policy and Procedures',                 'Risk Assessment'),
  ((select id from fw), 'RA-2',      'Security Categorization',                               'Risk Assessment'),
  ((select id from fw), 'RA-3',      'Risk Assessment',                                       'Risk Assessment'),
  ((select id from fw), 'RA-3(1)',   'Risk Assessment — Supply Chain Risk Assessment',        'Risk Assessment'),
  ((select id from fw), 'RA-5',      'Vulnerability Monitoring and Scanning',                 'Risk Assessment'),
  ((select id from fw), 'RA-5(2)',   'Vulnerability Monitoring — Update Vulnerabilities Scanned', 'Risk Assessment'),
  ((select id from fw), 'RA-5(4)',   'Vulnerability Monitoring — Discoverable Information',  'Risk Assessment'),
  ((select id from fw), 'RA-5(5)',   'Vulnerability Monitoring — Privileged Access',         'Risk Assessment'),
  ((select id from fw), 'RA-7',      'Risk Response',                                         'Risk Assessment'),
  -- SA — System and Services Acquisition
  ((select id from fw), 'SA-1',      'System and Services Acquisition Policy',               'System Acquisition'),
  ((select id from fw), 'SA-2',      'Allocation of Resources',                               'System Acquisition'),
  ((select id from fw), 'SA-3',      'System Development Life Cycle',                         'System Acquisition'),
  ((select id from fw), 'SA-4',      'Acquisition Process',                                   'System Acquisition'),
  ((select id from fw), 'SA-5',      'System Documentation',                                  'System Acquisition'),
  ((select id from fw), 'SA-8',      'Security and Privacy Engineering Principles',          'System Acquisition'),
  ((select id from fw), 'SA-9',      'External System Services',                              'System Acquisition'),
  ((select id from fw), 'SA-10',     'Developer Configuration Management',                   'System Acquisition'),
  ((select id from fw), 'SA-11',     'Developer Testing and Evaluation',                     'System Acquisition'),
  ((select id from fw), 'SA-15',     'Development Process, Standards, and Tools',            'System Acquisition'),
  ((select id from fw), 'SA-17',     'Developer Security and Privacy Architecture',          'System Acquisition'),
  ((select id from fw), 'SA-22',     'Unsupported System Components',                        'System Acquisition'),
  -- SC — System and Communications Protection
  ((select id from fw), 'SC-1',      'System and Communications Protection Policy',          'System & Comms Protection'),
  ((select id from fw), 'SC-2',      'Separation of System and User Functionality',          'System & Comms Protection'),
  ((select id from fw), 'SC-4',      'Information in Shared System Resources',               'System & Comms Protection'),
  ((select id from fw), 'SC-5',      'Denial of Service Protection',                         'System & Comms Protection'),
  ((select id from fw), 'SC-7',      'Boundary Protection',                                  'System & Comms Protection'),
  ((select id from fw), 'SC-7(3)',   'Boundary Protection — Access Points',                  'System & Comms Protection'),
  ((select id from fw), 'SC-7(4)',   'Boundary Protection — External Telecommunications Services', 'System & Comms Protection'),
  ((select id from fw), 'SC-7(5)',   'Boundary Protection — Deny by Default',                'System & Comms Protection'),
  ((select id from fw), 'SC-7(7)',   'Boundary Protection — Split Tunneling for Remote Devices', 'System & Comms Protection'),
  ((select id from fw), 'SC-8',      'Transmission Confidentiality and Integrity',           'System & Comms Protection'),
  ((select id from fw), 'SC-8(1)',   'Transmission Confidentiality — Cryptographic Protection', 'System & Comms Protection'),
  ((select id from fw), 'SC-10',     'Network Disconnect',                                   'System & Comms Protection'),
  ((select id from fw), 'SC-12',     'Cryptographic Key Establishment and Management',       'System & Comms Protection'),
  ((select id from fw), 'SC-13',     'Cryptographic Protection',                             'System & Comms Protection'),
  ((select id from fw), 'SC-15',     'Collaborative Computing Devices and Applications',     'System & Comms Protection'),
  ((select id from fw), 'SC-17',     'Public Key Infrastructure Certificates',               'System & Comms Protection'),
  ((select id from fw), 'SC-18',     'Mobile Code',                                          'System & Comms Protection'),
  ((select id from fw), 'SC-19',     'Voice over IP Technologies',                           'System & Comms Protection'),
  ((select id from fw), 'SC-20',     'Secure Name/Address Resolution Service (Authoritative Source)', 'System & Comms Protection'),
  ((select id from fw), 'SC-21',     'Secure Name/Address Resolution Service (Recursive)',   'System & Comms Protection'),
  ((select id from fw), 'SC-22',     'Architecture and Provisioning for Name/Address Resolution', 'System & Comms Protection'),
  ((select id from fw), 'SC-28',     'Protection of Information at Rest',                    'System & Comms Protection'),
  ((select id from fw), 'SC-28(1)',  'Protection of Information at Rest — Cryptographic Protection', 'System & Comms Protection'),
  ((select id from fw), 'SC-39',     'Process Isolation',                                    'System & Comms Protection'),
  -- SI — System and Information Integrity
  ((select id from fw), 'SI-1',      'System and Information Integrity Policy',              'System & Info Integrity'),
  ((select id from fw), 'SI-2',      'Flaw Remediation',                                     'System & Info Integrity'),
  ((select id from fw), 'SI-2(2)',   'Flaw Remediation — Automated Flaw Remediation Status', 'System & Info Integrity'),
  ((select id from fw), 'SI-3',      'Malicious Code Protection',                            'System & Info Integrity'),
  ((select id from fw), 'SI-3(1)',   'Malicious Code Protection — Central Management',       'System & Info Integrity'),
  ((select id from fw), 'SI-4',      'System Monitoring',                                    'System & Info Integrity'),
  ((select id from fw), 'SI-4(2)',   'System Monitoring — Automated Tools and Mechanisms',   'System & Info Integrity'),
  ((select id from fw), 'SI-4(4)',   'System Monitoring — Inbound and Outbound Communications', 'System & Info Integrity'),
  ((select id from fw), 'SI-4(5)',   'System Monitoring — System-Generated Alerts',          'System & Info Integrity'),
  ((select id from fw), 'SI-5',      'Security Alerts, Advisories, and Directives',          'System & Info Integrity'),
  ((select id from fw), 'SI-6',      'Security and Privacy Function Verification',           'System & Info Integrity'),
  ((select id from fw), 'SI-7',      'Software, Firmware, and Information Integrity',        'System & Info Integrity'),
  ((select id from fw), 'SI-8',      'Spam Protection',                                      'System & Info Integrity'),
  ((select id from fw), 'SI-10',     'Information Input Validation',                         'System & Info Integrity'),
  ((select id from fw), 'SI-11',     'Error Handling',                                       'System & Info Integrity'),
  ((select id from fw), 'SI-12',     'Information Management and Retention',                 'System & Info Integrity'),
  ((select id from fw), 'SI-16',     'Memory Protection',                                    'System & Info Integrity'),
  -- SR — Supply Chain Risk Management (Rev 5)
  ((select id from fw), 'SR-1',      'Supply Chain Risk Management Policy',                  'Supply Chain Risk'),
  ((select id from fw), 'SR-2',      'Supply Chain Risk Management Plan',                    'Supply Chain Risk'),
  ((select id from fw), 'SR-3',      'Supply Chain Controls and Processes',                  'Supply Chain Risk'),
  ((select id from fw), 'SR-5',      'Acquisition Strategies, Tools, and Methods',           'Supply Chain Risk'),
  ((select id from fw), 'SR-6',      'Supplier Assessments and Reviews',                     'Supply Chain Risk'),
  ((select id from fw), 'SR-8',      'Notification Agreements',                              'Supply Chain Risk'),
  ((select id from fw), 'SR-9',      'Tamper Resistance and Detection',                      'Supply Chain Risk'),
  ((select id from fw), 'SR-10',     'Inspection of Systems or Components',                  'Supply Chain Risk'),
  ((select id from fw), 'SR-11',     'Component Authenticity',                               'Supply Chain Risk'),
  ((select id from fw), 'SR-12',     'Component Disposal',                                   'Supply Chain Risk')
on conflict (framework_id, control_id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Cross-framework control mappings
-- SOC 2 ↔ ISO 27001 ↔ FedRAMP (key equivalences)
-- ─────────────────────────────────────────────────────────────

insert into grc_control_mappings (control_id_a, control_id_b, relationship)
select a.id, b.id, m.rel
from (values
  -- SOC 2 → ISO 27001
  ('soc2','CC6.1',   'iso27001','A.5.15',  'equivalent'),
  ('soc2','CC6.2',   'iso27001','A.5.16',  'equivalent'),
  ('soc2','CC6.3',   'iso27001','A.5.18',  'equivalent'),
  ('soc2','CC6.5',   'iso27001','A.6.5',   'equivalent'),
  ('soc2','CC6.6',   'iso27001','A.8.8',   'equivalent'),
  ('soc2','CC6.7',   'iso27001','A.5.14',  'equivalent'),
  ('soc2','CC6.8',   'iso27001','A.8.7',   'equivalent'),
  ('soc2','CC7.1',   'iso27001','A.8.16',  'equivalent'),
  ('soc2','CC7.2',   'iso27001','A.8.15',  'equivalent'),
  ('soc2','CC7.3',   'iso27001','A.5.24',  'equivalent'),
  ('soc2','CC7.4',   'iso27001','A.5.26',  'equivalent'),
  ('soc2','CC7.5',   'iso27001','A.5.29',  'equivalent'),
  ('soc2','CC8.1',   'iso27001','A.8.32',  'equivalent'),
  ('soc2','CC9.1',   'iso27001','A.5.7',   'covers'),
  ('soc2','CC9.2',   'iso27001','A.5.19',  'equivalent'),
  ('soc2','CC1.1',   'iso27001','A.5.2',   'equivalent'),
  ('soc2','CC3.2',   'iso27001','A.5.8',   'partial'),
  ('soc2','CC4.1',   'iso27001','A.5.35',  'equivalent'),
  -- SOC 2 → FedRAMP
  ('soc2','CC6.1',   'fedramp','AC-3',     'equivalent'),
  ('soc2','CC6.2',   'fedramp','AC-2',     'equivalent'),
  ('soc2','CC6.3',   'fedramp','AC-6',     'equivalent'),
  ('soc2','CC6.5',   'fedramp','PS-4',     'equivalent'),
  ('soc2','CC6.6',   'fedramp','SI-3',     'equivalent'),
  ('soc2','CC7.1',   'fedramp','SI-4',     'equivalent'),
  ('soc2','CC7.2',   'fedramp','AU-2',     'equivalent'),
  ('soc2','CC7.3',   'fedramp','IR-4',     'equivalent'),
  ('soc2','CC7.5',   'fedramp','CP-10',    'equivalent'),
  ('soc2','CC8.1',   'fedramp','CM-3',     'equivalent'),
  ('soc2','CC9.2',   'fedramp','SA-9',     'equivalent'),
  -- ISO 27001 → FedRAMP
  ('iso27001','A.5.15',  'fedramp','AC-3',     'equivalent'),
  ('iso27001','A.5.16',  'fedramp','AC-2',     'equivalent'),
  ('iso27001','A.5.17',  'fedramp','IA-5',     'equivalent'),
  ('iso27001','A.5.18',  'fedramp','AC-6',     'equivalent'),
  ('iso27001','A.5.24',  'fedramp','IR-1',     'equivalent'),
  ('iso27001','A.5.26',  'fedramp','IR-4',     'equivalent'),
  ('iso27001','A.5.29',  'fedramp','CP-2',     'equivalent'),
  ('iso27001','A.5.34',  'fedramp','PT-3',     'equivalent'),
  ('iso27001','A.6.1',   'fedramp','PS-3',     'equivalent'),
  ('iso27001','A.6.5',   'fedramp','PS-4',     'equivalent'),
  ('iso27001','A.8.5',   'fedramp','IA-2',     'equivalent'),
  ('iso27001','A.8.8',   'fedramp','RA-5',     'equivalent'),
  ('iso27001','A.8.13',  'fedramp','CP-9',     'equivalent'),
  ('iso27001','A.8.15',  'fedramp','AU-2',     'equivalent'),
  ('iso27001','A.8.16',  'fedramp','SI-4',     'equivalent'),
  ('iso27001','A.8.24',  'fedramp','SC-13',    'equivalent'),
  ('iso27001','A.8.32',  'fedramp','CM-3',     'equivalent'),
  -- ISO 27701 → ISO 27001 (PIMS extends ISMS)
  ('iso27701','6.2.1',  'iso27001','A.5.34',   'covers'),
  ('iso27701','6.2.3',  'iso27001','A.5.34',   'partial'),
  ('iso27701','6.3.5',  'iso27001','A.8.10',   'covers'),
  -- ISO 27701 → FedRAMP
  ('iso27701','6.2.1',  'fedramp','PT-2',      'equivalent'),
  ('iso27701','6.2.3',  'fedramp','PT-4',      'equivalent'),
  ('iso27701','6.3.1',  'fedramp','PT-5',      'equivalent'),
  ('iso27701','6.3.7',  'fedramp','PT-3',      'equivalent'),
  -- ISO 27018 → ISO 27701
  ('iso27018','P.1',    'iso27701','6.2.1',    'equivalent'),
  ('iso27018','P.3',    'iso27701','6.4.1',    'equivalent'),
  ('iso27018','P.4',    'iso27701','6.4.4',    'equivalent'),
  ('iso27018','P.7',    'iso27701','6.3.1',    'equivalent'),
  ('iso27018','P.8',    'iso27701','6.3.4',    'equivalent')
) as m(fw_a, ctrl_a, fw_b, ctrl_b, rel)
join grc_controls a on a.control_id = m.ctrl_a
  and a.framework_id = (select id from grc_frameworks where key = m.fw_a)
join grc_controls b on b.control_id = m.ctrl_b
  and b.framework_id = (select id from grc_frameworks where key = m.fw_b)
on conflict (control_id_a, control_id_b) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Auto-create grc_implementations for all new controls
-- ─────────────────────────────────────────────────────────────

insert into grc_implementations (control_id, status)
select id, 'not_started'
from grc_controls
where id not in (select control_id from grc_implementations)
on conflict (control_id) do nothing;
