'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

type Member = { id: string; full_name: string | null; role: string; created_at: string }
type Invitation = { id: string; email: string; role: string; created_at: string; expires_at: string; accepted_at: string | null }

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  org_admin: 'default',
  chaplain: 'secondary',
  user: 'outline',
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function TeamClient({
  currentUserId,
  currentRole,
  isAdmin,
  members,
  invitations,
}: {
  currentUserId: string
  currentRole: string
  isAdmin: boolean
  members: Member[]
  invitations: Invitation[]
}) {
  const router = useRouter()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('chaplain')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the organization?')) return
    await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    router.refresh()
  }

  async function handleRoleChange(memberId: string, role: string) {
    await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>People with access to your organization</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials(member.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.full_name ?? 'Unnamed user'}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && member.id !== currentUserId ? (
                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    <option value="org_admin">Org Admin</option>
                    <option value="chaplain">Chaplain</option>
                    <option value="user">User</option>
                  </select>
                ) : (
                  <Badge variant={ROLE_COLORS[member.role] ?? 'outline'} className="capitalize text-xs">
                    {member.role.replace('_', ' ')}
                  </Badge>
                )}
                {isAdmin && member.id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive text-xs"
                    onClick={() => handleRemove(member.id)}
                  >
                    Remove
                  </Button>
                )}
                {member.id === currentUserId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({invitations.length})</CardTitle>
            <CardDescription>Invitations awaiting acceptance</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize text-xs">
                  {inv.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>They&apos;ll receive an email with a sign-up link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="chaplain@hospital.org"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inviteRole">Role</Label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="border rounded px-3 py-2 text-sm bg-background h-10"
                >
                  <option value="org_admin">Org Admin</option>
                  <option value="chaplain">Chaplain</option>
                  <option value="user">User</option>
                </select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send invite'}
              </Button>
            </form>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
