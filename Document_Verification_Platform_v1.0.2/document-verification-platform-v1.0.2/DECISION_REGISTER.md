# DECISION_REGISTER.md

## Document Verification Platform --- Product and Technical Decisions

**Version:** 1.0\
**Purpose:** Separate decisions already confirmed by the owner from
recommended defaults that still require approval.

------------------------------------------------------------------------

## 1. Confirmed by Product Owner

  -----------------------------------------------------------------------
  ID                      Decision                Status
  ----------------------- ----------------------- -----------------------
  C-01                    All registered users    Confirmed
                          may submit documents    

  C-02                    Users may access and    Confirmed
                          verify only documents   
                          owned by their own      
                          account                 

  C-03                    Verification methods    Confirmed
                          are QR Code, unique     
                          code, and PDF re-upload 
                          for hash comparison     

  C-04                    Hash search covers all  Confirmed
                          approved documents      
                          owned by the active     
                          user                    

  C-05                    Administrator checks    Confirmed
                          completeness,           
                          readability, category   
                          suitability, and        
                          registration            
                          eligibility             

  C-06                    All document types may  Confirmed
                          be submitted if they    
                          comply with platform    
                          policy                  

  C-07                    Category is for         Confirmed
                          classification, not a   
                          closed allowlist        

  C-08                    MVP upload metadata is: Confirmed
                          document title,         
                          category, conditional   
                          custom type for         
                          `Lainnya`, PDF,         
                          optional document date, 
                          optional issuing        
                          institution, optional   
                          description, required   
                          policy consent          

  C-09                    Visual direction is     Confirmed
                          Enterprise Trust ×      
                          Premium Technology      

  C-10                    Silver/white workspace, Confirmed
                          graphite sidebar, clear 
                          blue CTA, Light and     
                          Dark themes             

  C-11                    Design starts with User Confirmed
                          Workspace, then Admin   
                          Workspace               
  -----------------------------------------------------------------------

## 2. Recommended Defaults --- Owner Approval Needed

These defaults are proposed to make MVP implementation coherent. They
are not represented as owner-approved facts.

  ---------------------------------------------------------------------------
  ID              Decision to approve  Recommended default  Why
  --------------- -------------------- -------------------- -----------------
  R-01            Technology stack     Next.js App Router + One coherent MVP
                                       TypeScript +         stack
                                       Tailwind + Supabase  

  R-02            Maximum PDF size     20 MiB, configurable Practical
                                       by                   starting limit;
                                       environment/bucket   not hardcoded in
                                                            UI

  R-03            Password-protected   Reject with clear    Reviewer and
                  PDF                  error                scanner need
                                                            readable content

  R-04            Email verification   Required before      Reduce
                                       first document       disposable/spam
                                       submission           accounts

  R-05            Reviewer scope       Shared queue: all    Avoid assignment
                                       `reviewer` accounts  complexity in MVP
                                       can see pending      
                                       submissions          

  R-06            Admin access         `platform_admin`     Least privilege
                                       does not             
                                       automatically        
                                       receive document     
                                       preview permission;  
                                       assign reviewer role 
                                       separately           

  R-07            Review count         One reviewer         Simpler MVP
                                       decision per         workflow
                                       submission version   

  R-08            Reviewer download    Preview only;        Reduce
                                       download disabled    unnecessary file
                                                            distribution

  R-09            Rejected submission  Rejected version is  Preserve clear
                                       terminal; a new      history
                                       attempt creates a    
                                       new document record  

  R-10            Revision             New immutable        Preserve version
                  resubmission         version under the    and review
                                       same document record history

  R-11            Revocation           Platform admin only, Controlled
                                       mandatory reason,    administrative
                                       audit event; UI/API  action
                                       disabled until       
                                       approved             

  R-12            Notifications        In-app notifications Avoid provider
                                       for MVP; email later dependency
                                                            initially

  R-13            Initial categories   Pendidikan,          Useful
                                       Pekerjaan,           classification
                                       Organisasi,          starter
                                       Administrasi,        
                                       Keuangan, Kesehatan, 
                                       Hukum, Pribadi,      
                                       Lainnya; expandable  

  R-14            Malware scanning     Required before      Protect reviewers
                                       public production;   and platform
                                       provider to be       
                                       selected             

  R-15            Data retention       No period invented;  Must align with
                                       legal/privacy        policy and law
                                       approval required    
                                       before public launch 

  R-16            Admin user           Visual reference     Avoid unsafe
                  management           only; role           self-service
                                       assignment via       privilege changes
                                       trusted operator for 
                                       MVP                  

  R-17            System settings UI   Visual reference     Prevent
                                       only; no sensitive   uncontrolled
                                       settings mutation in platform changes
                                       MVP                  

  R-18            Public verification  Out of MVP;          Matches confirmed
                                       verification remains access rule
                                       authenticated and    
                                       owner-only           
  ---------------------------------------------------------------------------

## 3. Decisions Blocking Production

These items can be developed behind configuration or feature flags, but
must be settled before public launch:

1.  Confirm maximum PDF size and encrypted PDF behavior.
2.  Approve privacy policy, acceptable-use policy, and document
    retention/deletion rules.
3.  Select malware scanning solution.
4.  Select email provider if email verification/notifications are
    enabled.
5.  Select final domain and product name.
6.  Approve the revocation authority and process.
7.  Approve the exact initial category list.
8.  Review consent wording and privacy language with an appropriate
    legal/privacy reviewer.

## 4. Assumption Handling

-   Codex must not silently convert a recommended default into an
    approved product decision.
-   If a recommendation is not approved, keep it configurable or leave
    the feature disabled.
-   Security-critical controls must not be removed just because a visual
    mockup omits them.
-   The confirmed decisions in section 1 take precedence over older
    draft statements.

## 5. Technical Implementation Notes

-   QR content uses an opaque credential UUID, not the verification code
    in the URL.
-   Verification code is derived server-side using HMAC and stored as a
    digest for lookup.
-   The supplied database workflow RPCs are a technical implementation
    draft; they must be run and tested in a local Supabase environment
    before staging.
-   The initial upload flow requires compensating cleanup if the private
    Storage upload succeeds but the database RPC fails.
