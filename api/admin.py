from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from django.db.models import Count
from django.urls import reverse
from django.utils.html import format_html
from .models import (
    Utilisateur, Parent, Enseignant, Groupe, Etudiant, Inscription,
    Planning, Seance, Evaluation, Note, Absence, Paiement, BulletinSalaire,
    Ressource, Message, PieceJointe, Notification, PreferenceNotification,
    Audit, ParametreSysteme
)


# ============================================================
# 1. UTILISATEUR ADMIN
# ============================================================

@admin.register(Utilisateur)
class UtilisateurAdmin(BaseUserAdmin):
    """Admin pour le modèle Utilisateur"""

    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        (_('Personal Info'), {'fields': ('first_name', 'last_name', 'telephone', 'adresse', 'wilaya')}),
        (_('Roles & Status'), {'fields': ('role', 'statut')}),
        (_('Security'),
         {'fields': ('permission_2fa', 'tentatives_echouees', 'compte_verrouille', 'date_verrouillage')}),
        (_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('date_inscription', 'derniere_connexion', 'last_login')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'role'),
        }),
    )

    list_display = ('email', 'get_full_name', 'role', 'statut', 'is_active', 'date_inscription')
    list_filter = ('role', 'statut', 'is_active', 'date_inscription')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_inscription',)
    readonly_fields = ('date_inscription', 'derniere_connexion', 'last_login')

    def get_full_name(self, obj):
        return obj.get_full_name()

    get_full_name.short_description = 'Nom Complet'


# ============================================================
# 2. PARENT ADMIN
# ============================================================

@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    """Admin pour le modèle Parent"""

    fieldsets = (
        ('Informations Utilisateur', {'fields': ('user',)}),
        ('Détails Parent', {'fields': ('relation_enfant',)}),
        ('RGPD', {'fields': ('consentement_rgpd', 'date_consentement')}),
        ('Métadonnées', {'fields': ('date_creation',), 'classes': ('collapse',)}),
    )

    list_display = ('get_full_name', 'get_email', 'relation_enfant', 'consentement_rgpd', 'nombre_enfants',
                    'date_creation')
    list_filter = ('relation_enfant', 'consentement_rgpd', 'date_creation')
    search_fields = ('user__first_name', 'user__last_name', 'user__email')
    readonly_fields = ('date_creation',)
    raw_id_fields = ('user',)

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    get_full_name.short_description = 'Nom Complet'

    def get_email(self, obj):
        return obj.user.email

    get_email.short_description = 'Email'

    def nombre_enfants(self, obj):
        count = obj.enfants.count()
        return format_html(f'<span style="color: #0066cc;"><b>{count}</b></span>')

    nombre_enfants.short_description = 'Nombre d\'Enfants'


# ============================================================
# 3. ENSEIGNANT ADMIN
# ============================================================

@admin.register(Enseignant)
class EnseignantAdmin(admin.ModelAdmin):
    """Admin pour le modèle Enseignant"""

    fieldsets = (
        ('Informations Utilisateur', {'fields': ('user',)}),
        ('Informations Professionnelles', {
            'fields': ('langue_enseignee', 'niveaux', 'qualification', 'experience_annees')
        }),
        ('Contrat & Salaire', {
            'fields': ('type_contrat', 'date_debut_contrat', 'date_fin_contrat', 'tarif_horaire',
                       'heures_travaillees_mois', 'salaire_mois', 'statut_emploi')
        }),
        ('Disponibilité', {'fields': ('disponibilite',), 'classes': ('collapse',)}),
        ('Métadonnées', {'fields': ('date_creation', 'date_modification'), 'classes': ('collapse',)}),
    )

    list_display = ('get_full_name', 'langue_enseignee', 'type_contrat', 'statut_emploi', 'tarif_horaire',
                    'nombre_groupes', 'date_creation')
    list_filter = ('langue_enseignee', 'type_contrat', 'statut_emploi', 'date_creation')
    search_fields = ('user__first_name', 'user__last_name', 'langue_enseignee')
    readonly_fields = ('date_creation', 'date_modification')
    raw_id_fields = ('user',)

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    get_full_name.short_description = 'Nom Complet'

    def nombre_groupes(self, obj):
        count = obj.groupes.count()
        return format_html(f'<span style="color: #0066cc;"><b>{count}</b></span>')

    nombre_groupes.short_description = 'Groupes'


# ============================================================
# 4. GROUPE ADMIN
# ============================================================

@admin.register(Groupe)
class GroupeAdmin(admin.ModelAdmin):
    """Admin pour le modèle Groupe"""

    fieldsets = (
        ('Informations Générales', {
            'fields': ('nom_groupe', 'langue', 'niveau', 'enseignant')
        }),
        ('Détails de Classe', {
            'fields': ('salle', 'capacite_max', 'nombre_etudiants', 'tarif_mensuel')
        }),
        ('Dates', {
            'fields': ('date_debut', 'date_fin', 'duree_semaines')
        }),
        ('Statut & Métadonnées', {
            'fields': ('statut_groupe', 'date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('nom_groupe', 'langue', 'niveau', 'enseignant', 'nombre_etudiants', 'capacite_max', 'statut_groupe',
                    'date_debut')
    list_filter = ('langue', 'niveau', 'statut_groupe', 'date_debut', 'enseignant')
    search_fields = ('nom_groupe', 'enseignant__user__last_name')
    readonly_fields = ('date_creation', 'date_modification')
    raw_id_fields = ('enseignant',)

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return self.readonly_fields + ('nombre_etudiants',)
        return self.readonly_fields


# ============================================================
# 5. ETUDIANT ADMIN
# ============================================================

@admin.register(Etudiant)
class EtudiantAdmin(admin.ModelAdmin):
    """Admin pour le modèle Étudiant"""

    fieldsets = (
        ('Informations Utilisateur', {'fields': ('user',)}),
        ('Informations Personnelles', {
            'fields': ('date_naissance', 'genre', 'parent')
        }),
        ('Informations Académiques', {
            'fields': ('groupe', 'niveau_actuel', 'moyenne_generale', 'taux_assiduité')
        }),
        ('Statut', {'fields': ('statut_etudiant',)}),
        ('Métadonnées', {'fields': ('date_inscription', 'date_modification'), 'classes': ('collapse',)}),
    )

    list_display = ('get_full_name', 'groupe', 'niveau_actuel', 'moyenne_generale', 'taux_assiduité', 'statut_etudiant',
                    'date_inscription')
    list_filter = ('niveau_actuel', 'statut_etudiant', 'groupe', 'date_inscription')
    search_fields = ('user__first_name', 'user__last_name', 'groupe__nom_groupe')
    readonly_fields = ('date_inscription', 'date_modification')
    raw_id_fields = ('user', 'parent', 'groupe')

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    get_full_name.short_description = 'Nom Complet'


# ============================================================
# 6. INSCRIPTION ADMIN (INLINE)
# ============================================================

class InscriptionInline(admin.TabularInline):
    """Inline pour les inscriptions"""
    model = Inscription
    extra = 1
    raw_id_fields = ('groupe',)
    readonly_fields = ('date_inscription',)


@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    """Admin pour le modèle Inscription"""

    fieldsets = (
        ('Inscription', {
            'fields': ('etudiant', 'groupe')
        }),
        ('Statut', {
            'fields': ('statut_inscription',)
        }),
        ('Métadonnées', {
            'fields': ('date_inscription',),
            'classes': ('collapse',)
        }),
    )

    list_display = ('etudiant', 'groupe', 'statut_inscription', 'date_inscription')
    list_filter = ('statut_inscription', 'date_inscription', 'groupe')
    search_fields = ('etudiant__user__last_name', 'groupe__nom_groupe')
    readonly_fields = ('date_inscription',)
    raw_id_fields = ('etudiant', 'groupe')


# ============================================================
# 7. PLANNING ADMIN
# ============================================================

@admin.register(Planning)
class PlanningAdmin(admin.ModelAdmin):
    """Admin pour le modèle Planning"""

    fieldsets = (
        ('Informations Générales', {
            'fields': ('groupe', 'jour', 'heure_debut', 'heure_fin', 'salle', 'enseignant')
        }),
        ('Récurrence', {
            'fields': ('recurence', 'date_fin_recurence')
        }),
        ('Détails', {
            'fields': ('description', 'notes_planning', 'statut_planning')
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('groupe', 'jour', 'heure_debut', 'heure_fin', 'enseignant', 'recurence', 'statut_planning')
    list_filter = ('jour', 'recurence', 'statut_planning', 'groupe')
    search_fields = ('groupe__nom_groupe', 'enseignant__user__last_name')
    readonly_fields = ('date_creation', 'date_modification')
    raw_id_fields = ('groupe', 'enseignant')


# ============================================================
# 8. SEANCE ADMIN
# ============================================================

@admin.register(Seance)
class SeanceAdmin(admin.ModelAdmin):
    """Admin pour le modèle Séance"""

    fieldsets = (
        ('Informations Générales', {
            'fields': ('groupe', 'date_seance', 'jour', 'heure_debut', 'heure_fin', 'salle')
        }),
        ('Type & Détails', {
            'fields': ('type_seance', 'description', 'planning')
        }),
        ('Statut', {
            'fields': ('statut_seance',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('groupe', 'date_seance', 'heure_debut', 'type_seance', 'statut_seance')
    list_filter = ('type_seance', 'statut_seance', 'date_seance', 'groupe')
    search_fields = ('groupe__nom_groupe',)
    readonly_fields = ('date_creation', 'date_modification')
    raw_id_fields = ('groupe', 'planning')
    date_hierarchy = 'date_seance'


# ============================================================
# 9. EVALUATION ADMIN
# ============================================================

@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    """Admin pour le modèle Évaluation"""

    fieldsets = (
        ('Informations Générales', {
            'fields': ('groupe', 'titre', 'type', 'date_evaluation')
        }),
        ('Détails', {
            'fields': ('description', 'duree_minutes', 'note_max', 'ponderation')
        }),
        ('Statut', {
            'fields': ('statut_eval',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('titre', 'groupe', 'type', 'date_evaluation', 'note_max', 'ponderation', 'statut_eval')
    list_filter = ('type', 'statut_eval', 'date_evaluation', 'groupe')
    search_fields = ('titre', 'groupe__nom_groupe')
    readonly_fields = ('date_creation', 'date_modification')
    raw_id_fields = ('groupe',)
    date_hierarchy = 'date_evaluation'


# ============================================================
# 10. NOTE ADMIN
# ============================================================

@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    """Admin pour le modèle Note"""

    fieldsets = (
        ('Informations', {
            'fields': ('etudiant', 'evaluation')
        }),
        ('Notation', {
            'fields': ('note_obtenue', 'note_max', 'pourcentage', 'niveau_attribue')
        }),
        ('Évaluation', {
            'fields': ('statut_passage', 'remarque_prof')
        }),
        ('Métadonnées', {
            'fields': ('date_saisie', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('etudiant', 'evaluation', 'note_obtenue', 'pourcentage', 'niveau_attribue', 'statut_passage')
    list_filter = ('niveau_attribue', 'statut_passage', 'date_saisie', 'evaluation__groupe')
    search_fields = ('etudiant__user__last_name', 'evaluation__titre')
    readonly_fields = ('pourcentage', 'niveau_attribue', 'date_saisie', 'date_modification')
    raw_id_fields = ('etudiant', 'evaluation')


# ============================================================
# 11. ABSENCE ADMIN
# ============================================================

@admin.register(Absence)
class AbsenceAdmin(admin.ModelAdmin):
    """Admin pour le modèle Absence"""

    fieldsets = (
        ('Informations', {
            'fields': ('etudiant', 'seance', 'date_absence')
        }),
        ('Détails', {
            'fields': ('statut_absence', 'justification', 'raison')
        }),
        ('Métadonnées', {
            'fields': ('date_saisie', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('etudiant', 'seance', 'date_absence', 'statut_absence', 'justification')
    list_filter = ('statut_absence', 'date_absence', 'seance__groupe')
    search_fields = ('etudiant__user__last_name', 'seance__groupe__nom_groupe')
    readonly_fields = ('date_saisie', 'date_modification')
    raw_id_fields = ('etudiant', 'seance')
    date_hierarchy = 'date_absence'


# ============================================================
# 12. PAIEMENT ADMIN
# ============================================================

@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    """Admin pour le modèle Paiement"""

    fieldsets = (
        ('Étudiant', {'fields': ('etudiant',)}),
        ('Montants', {
            'fields': ('montant_du', 'montant_paye', 'solde')
        }),
        ('Détails de Paiement', {
            'fields': ('mode_paiement', 'reference_paiement', 'date_paiement', 'periode', 'date_echeance')
        }),
        ('Statut & Relances', {
            'fields': ('statut_paiement', 'relances_envoyees', 'derniere_relance')
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('etudiant', 'montant_du', 'montant_paye', 'solde', 'statut_paiement', 'date_paiement')
    list_filter = ('statut_paiement', 'mode_paiement', 'date_paiement')
    search_fields = ('etudiant__user__last_name', 'reference_paiement')
    readonly_fields = ('solde', 'date_creation', 'date_modification')
    raw_id_fields = ('etudiant',)
    date_hierarchy = 'date_paiement'


# ============================================================
# 13. BULLETIN SALAIRE ADMIN
# ============================================================

@admin.register(BulletinSalaire)
class BulletinSalaireAdmin(admin.ModelAdmin):
    """Admin pour le modèle Bulletin de Salaire"""

    fieldsets = (
        ('Enseignant', {'fields': ('enseignant',)}),
        ('Période & Heures', {
            'fields': ('periode', 'heures_travaillees', 'tarif_horaire')
        }),
        ('Salaire', {
            'fields': ('salaire_brut', 'assurance', 'cotisations', 'autres_retenues', 'total_retenues', 'salaire_net')
        }),
        ('Paiement', {
            'fields': ('mode_paiement', 'date_paiement', 'statut_paiement')
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('enseignant', 'periode', 'heures_travaillees', 'salaire_brut', 'total_retenues', 'salaire_net',
                    'statut_paiement')
    list_filter = ('statut_paiement', 'mode_paiement', 'periode')
    search_fields = ('enseignant__user__last_name', 'periode')
    readonly_fields = ('salaire_brut', 'total_retenues', 'salaire_net', 'date_creation', 'date_modification')
    raw_id_fields = ('enseignant',)


# ============================================================
# 14. RESSOURCE ADMIN
# ============================================================

@admin.register(Ressource)
class RessourceAdmin(admin.ModelAdmin):
    """Admin pour le modèle Ressource"""

    fieldsets = (
        ('Informations Générales', {
            'fields': ('titre', 'type_ressource', 'enseignant', 'groupe')
        }),
        ('Contenu', {
            'fields': ('description', 'chemin_fichier', 'url_lien', 'taille_fichier')
        }),
        ('Détails', {
            'fields': ('niveau', 'visible_etudiants', 'date_disponibilite', 'nombre_telechargements')
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('titre', 'type_ressource', 'enseignant', 'groupe', 'niveau', 'visible_etudiants',
                    'nombre_telechargements')
    list_filter = ('type_ressource', 'visible_etudiants', 'niveau', 'date_creation')
    search_fields = ('titre', 'enseignant__user__last_name')
    readonly_fields = ('nombre_telechargements', 'date_creation', 'date_modification')
    raw_id_fields = ('enseignant', 'groupe')


# ============================================================
# 15. MESSAGE ADMIN
# ============================================================

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin pour le modèle Message"""

    fieldsets = (
        ('Correspondance', {
            'fields': ('expediteur', 'destinataire')
        }),
        ('Contenu', {
            'fields': ('sujet', 'contenu')
        }),
        ('Statut', {
            'fields': ('statut_message', 'lu', 'nombre_pieces_jointes')
        }),
        ('Dates', {
            'fields': ('date_envoi', 'date_lecture')
        }),
    )

    list_display = ('expediteur', 'destinataire', 'sujet', 'lu', 'statut_message', 'date_envoi')
    list_filter = ('lu', 'statut_message', 'date_envoi')
    search_fields = ('expediteur__email', 'destinataire__email', 'sujet')
    readonly_fields = ('date_envoi', 'date_lecture')
    raw_id_fields = ('expediteur', 'destinataire')
    date_hierarchy = 'date_envoi'


# ============================================================
# 16. PIECE JOINTE ADMIN (INLINE)
# ============================================================

class PieceJointeInline(admin.TabularInline):
    """Inline pour les pièces jointes"""
    model = PieceJointe
    extra = 1
    readonly_fields = ('date_upload',)


@admin.register(PieceJointe)
class PieceJointeAdmin(admin.ModelAdmin):
    """Admin pour le modèle Pièce Jointe"""

    fieldsets = (
        ('Message', {'fields': ('message',)}),
        ('Fichier', {
            'fields': ('nom_fichier', 'chemin_fichier', 'taille_fichier', 'type_fichier')
        }),
        ('Métadonnées', {
            'fields': ('date_upload',),
            'classes': ('collapse',)
        }),
    )

    list_display = ('nom_fichier', 'message', 'type_fichier', 'taille_fichier', 'date_upload')
    list_filter = ('type_fichier', 'date_upload')
    search_fields = ('nom_fichier', 'message__sujet')
    readonly_fields = ('date_upload',)
    raw_id_fields = ('message',)


# ============================================================
# 17. NOTIFICATION ADMIN
# ============================================================

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin pour le modèle Notification"""

    fieldsets = (
        ('Utilisateur', {'fields': ('utilisateur',)}),
        ('Contenu', {
            'fields': ('type_notification', 'titre', 'contenu')
        }),
        ('Paramètres', {
            'fields': ('canal', 'lien_action', 'urgent')
        }),
        ('Statut', {
            'fields': ('statut_notification',)
        }),
        ('Dates', {
            'fields': ('date_creation', 'date_lecture', 'date_programmee')
        }),
    )

    list_display = ('titre', 'utilisateur', 'type_notification', 'canal', 'statut_notification', 'urgent',
                    'date_creation')
    list_filter = ('type_notification', 'canal', 'statut_notification', 'urgent', 'date_creation')
    search_fields = ('utilisateur__email', 'titre')
    readonly_fields = ('date_creation',)
    raw_id_fields = ('utilisateur',)
    date_hierarchy = 'date_creation'


# ============================================================
# 18. PREFERENCE NOTIFICATION ADMIN
# ============================================================

@admin.register(PreferenceNotification)
class PreferenceNotificationAdmin(admin.ModelAdmin):
    """Admin pour le modèle Préférence de Notification"""

    fieldsets = (
        ('Utilisateur', {'fields': ('utilisateur',)}),
        ('Type de Notification', {'fields': ('type_notification',)}),
        ('Canaux', {
            'fields': ('canal_email', 'canal_sms', 'canal_app')
        }),
        ('Horaires', {
            'fields': ('heure_min_envoi', 'heure_max_envoi', 'jours_actives')
        }),
        ('Statut', {
            'fields': ('actif',)
        }),
        ('Métadonnées', {
            'fields': ('date_modification',),
            'classes': ('collapse',)
        }),
    )

    list_display = ('utilisateur', 'type_notification', 'canal_email', 'canal_sms', 'canal_app', 'actif')
    list_filter = ('actif', 'type_notification', 'date_modification')
    search_fields = ('utilisateur__email',)
    readonly_fields = ('date_modification',)
    raw_id_fields = ('utilisateur',)


# ============================================================
# 19. AUDIT ADMIN
# ============================================================

@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
    """Admin pour le modèle Audit"""

    fieldsets = (
        ('Utilisateur & Action', {
            'fields': ('utilisateur', 'action')
        }),
        ('Entité Modifiée', {
            'fields': ('entite', 'id_entite')
        }),
        ('Valeurs', {
            'fields': ('ancienne_valeur', 'nouvelle_valeur')
        }),
        ('Environnement', {
            'fields': ('adresse_ip', 'navigateur')
        }),
        ('Résultat', {
            'fields': ('resultat', 'message_erreur', 'raison')
        }),
        ('Métadonnées', {
            'fields': ('date_action',),
            'classes': ('collapse',)
        }),
    )

    list_display = ('date_action', 'utilisateur', 'action', 'entite', 'resultat', 'adresse_ip')
    list_filter = ('action', 'resultat', 'date_action')
    search_fields = ('utilisateur__email', 'entite')
    readonly_fields = ('date_action',)
    raw_id_fields = ('utilisateur',)
    date_hierarchy = 'date_action'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ============================================================
# 20. PARAMETRE SYSTEME ADMIN
# ============================================================

@admin.register(ParametreSysteme)
class ParametreSystemeAdmin(admin.ModelAdmin):
    """Admin pour le modèle Paramètre Système"""

    fieldsets = (
        ('Paramètre', {
            'fields': ('nom_parametre', 'valeur', 'type')
        }),
        ('Description', {
            'fields': ('description',)
        }),
        ('Permissions', {
            'fields': ('modifiable',)
        }),
        ('Métadonnées', {
            'fields': ('date_creation', 'date_modification'),
            'classes': ('collapse',)
        }),
    )

    list_display = ('nom_parametre', 'valeur', 'type', 'modifiable')
    list_filter = ('type', 'modifiable')
    search_fields = ('nom_parametre',)
    readonly_fields = ('date_creation', 'date_modification')


# ============================================================
# ADMIN SITE CUSTOMIZATION
# ============================================================

admin.site.site_header = "Gestion Langues - Administration"
admin.site.site_title = "Admin Gestion Langues"
admin.site.index_title = "Bienvenue sur le panneau d'administration"