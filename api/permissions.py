from rest_framework.permissions import BasePermission


# ============================================================
# PERMISSIONS PAR RÔLE
# Utilisation : @permission_classes([IsSecretariat])
# ============================================================

class IsSecretariat(BasePermission):
    """Secrétariat uniquement"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Secretariat'
        )


class IsComptable(BasePermission):
    """Comptable OU Secrétariat (le secrétariat hérite des droits comptable)"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['Comptable', 'Secretariat']
        )


class IsDirigeant(BasePermission):
    """Dirigeant uniquement"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Dirigeant'
        )


class IsEnseignant(BasePermission):
    """Enseignant uniquement"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Enseignant'
        )


class IsEtudiant(BasePermission):
    """Étudiant uniquement"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Etudiant'
        )


class IsParent(BasePermission):
    """Parent uniquement"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Parent'
        )


# ============================================================
# PERMISSIONS COMBINÉES (accès multi-rôles)
# ============================================================

class IsSecretariatOrDirigeant(BasePermission):
    """Secrétariat ou Dirigeant"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['Secretariat', 'Dirigeant']
        )


class IsComptableOrDirigeant(BasePermission):
    """Comptable, Secrétariat ou Dirigeant (secrétariat hérite des droits comptable)"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['Comptable', 'Secretariat', 'Dirigeant']
        )


class IsEnseignantOrDirigeant(BasePermission):
    """Enseignant ou Dirigeant"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['Enseignant', 'Dirigeant']
        )


class IsStaff(BasePermission):
    """Tout rôle staff (pas étudiant ni parent)"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['Secretariat', 'Comptable', 'Dirigeant', 'Enseignant']
        )


class IsEtudiantOrParent(BasePermission):
    """Étudiant ou Parent"""
    def has_permission(self, request, view):

            if not request.user or not request.user.is_authenticated:
                return False
            return request.user.role in ['Enseignant', 'Dirigeant']


class IsAuthenticated(BasePermission):
    """Tout utilisateur connecté (tous les rôles)"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)