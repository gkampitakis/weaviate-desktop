package weaviate

import "github.com/weaviate/weaviate-go-client/v5/weaviate/rbac"

type Role struct {
	Name string `json:"name"`

	Backups     []BackupsPermission     `json:"backups,omitempty"`
	Cluster     []ClusterPermission     `json:"cluster,omitempty"`
	Collections []CollectionsPermission `json:"collections,omitempty"`
	Data        []DataPermission        `json:"data,omitempty"`
	Nodes       []NodesPermission       `json:"nodes,omitempty"`
	Roles       []RolesPermission       `json:"roles,omitempty"`
	Replicate   []ReplicatePermission   `json:"replicate,omitempty"`
	Alias       []AliasPermission       `json:"alias,omitempty"`
	Tenants     []TenantsPermission     `json:"tenants,omitempty"`
	Users       []UsersPermission       `json:"users,omitempty"`
	Groups      []GroupPermission       `json:"groups,omitempty"`
}

type BackupsPermission struct {
	Actions    []string `json:"actions"`
	Collection string   `json:"collection"`
}

type ClusterPermission struct {
	Actions []string `json:"actions"`
}

type CollectionsPermission struct {
	Actions    []string `json:"actions"`
	Collection string   `json:"collection"`
}

type DataPermission struct {
	Actions    []string `json:"actions"`
	Collection string   `json:"collection"`
}

type NodesPermission struct {
	Actions    []string `json:"actions"`
	Collection string   `json:"collection"`
	Verbosity  string   `json:"verbosity"`
}

type RolesPermission struct {
	Actions []string `json:"actions"`
	Role    string   `json:"role"`
	Scope   string   `json:"scope"`
}

type ReplicatePermission struct {
	Actions    []string `json:"actions"`
	Collection string   `json:"collection"`
	Shard      string   `json:"shard"`
}

type AliasPermission struct {
	Actions    []string `json:"actions"`
	Alias      string   `json:"alias"`
	Collection string   `json:"collection"`
}

type TenantsPermission struct {
	Actions []string `json:"actions"`
}

type UsersPermission struct {
	Actions []string `json:"actions"`
}

type GroupPermission struct {
	Actions   []string `json:"actions"`
	Group     string   `json:"group"`
	GroupType string   `json:"groupType"`
}

func convertRbacRoleToRole(rbacRole rbac.Role) Role {
	role := Role{
		Name: rbacRole.Name,
	}

	// Convert Backups permissions
	if rbacRole.Backups != nil {
		role.Backups = make([]BackupsPermission, len(rbacRole.Backups))
		for i, bp := range rbacRole.Backups {
			actions := make([]string, len(bp.Actions))
			for j, a := range bp.Actions {
				actions[j] = string(a)
			}
			role.Backups[i] = BackupsPermission{
				Actions:    actions,
				Collection: bp.Collection,
			}
		}
	}

	// Convert Cluster permissions
	if rbacRole.Cluster != nil {
		role.Cluster = make([]ClusterPermission, len(rbacRole.Cluster))
		for i, cp := range rbacRole.Cluster {
			actions := make([]string, len(cp.Actions))
			for j, a := range cp.Actions {
				actions[j] = string(a)
			}
			role.Cluster[i] = ClusterPermission{
				Actions: actions,
			}
		}
	}

	// Convert Collections permissions
	if rbacRole.Collections != nil {
		role.Collections = make([]CollectionsPermission, len(rbacRole.Collections))
		for i, cp := range rbacRole.Collections {
			actions := make([]string, len(cp.Actions))
			for j, a := range cp.Actions {
				actions[j] = string(a)
			}
			role.Collections[i] = CollectionsPermission{
				Actions:    actions,
				Collection: cp.Collection,
			}
		}
	}

	// Convert Data permissions
	if rbacRole.Data != nil {
		role.Data = make([]DataPermission, len(rbacRole.Data))
		for i, dp := range rbacRole.Data {
			actions := make([]string, len(dp.Actions))
			for j, a := range dp.Actions {
				actions[j] = string(a)
			}
			role.Data[i] = DataPermission{
				Actions:    actions,
				Collection: dp.Collection,
			}
		}
	}

	// Convert Nodes permissions
	if rbacRole.Nodes != nil {
		role.Nodes = make([]NodesPermission, len(rbacRole.Nodes))
		for i, np := range rbacRole.Nodes {
			actions := make([]string, len(np.Actions))
			for j, a := range np.Actions {
				actions[j] = string(a)
			}
			role.Nodes[i] = NodesPermission{
				Actions:    actions,
				Collection: np.Collection,
				Verbosity:  np.Verbosity,
			}
		}
	}

	// Convert Roles permissions
	if rbacRole.Roles != nil {
		role.Roles = make([]RolesPermission, len(rbacRole.Roles))
		for i, rp := range rbacRole.Roles {
			actions := make([]string, len(rp.Actions))
			for j, a := range rp.Actions {
				actions[j] = string(a)
			}
			role.Roles[i] = RolesPermission{
				Actions: actions,
				Role:    rp.Role,
				Scope:   string(rp.Scope),
			}
		}
	}

	// Convert Replicate permissions
	if rbacRole.Replicate != nil {
		role.Replicate = make([]ReplicatePermission, len(rbacRole.Replicate))
		for i, rp := range rbacRole.Replicate {
			actions := make([]string, len(rp.Actions))
			for j, a := range rp.Actions {
				actions[j] = string(a)
			}
			role.Replicate[i] = ReplicatePermission{
				Actions:    actions,
				Collection: rp.Collection,
				Shard:      rp.Shard,
			}
		}
	}

	// Convert Alias permissions
	if rbacRole.Alias != nil {
		role.Alias = make([]AliasPermission, len(rbacRole.Alias))
		for i, ap := range rbacRole.Alias {
			actions := make([]string, len(ap.Actions))
			for j, a := range ap.Actions {
				actions[j] = string(a)
			}
			role.Alias[i] = AliasPermission{
				Actions:    actions,
				Alias:      ap.Alias,
				Collection: ap.Collection,
			}
		}
	}

	// Convert Tenants permissions
	if rbacRole.Tenants != nil {
		role.Tenants = make([]TenantsPermission, len(rbacRole.Tenants))
		for i, tp := range rbacRole.Tenants {
			actions := make([]string, len(tp.Actions))
			for j, a := range tp.Actions {
				actions[j] = string(a)
			}
			role.Tenants[i] = TenantsPermission{
				Actions: actions,
			}
		}
	}

	// Convert Users permissions
	if rbacRole.Users != nil {
		role.Users = make([]UsersPermission, len(rbacRole.Users))
		for i, up := range rbacRole.Users {
			actions := make([]string, len(up.Actions))
			for j, a := range up.Actions {
				actions[j] = string(a)
			}
			role.Users[i] = UsersPermission{
				Actions: actions,
			}
		}
	}

	// Convert Groups permissions
	if rbacRole.Groups != nil {
		role.Groups = make([]GroupPermission, len(rbacRole.Groups))
		for i, gp := range rbacRole.Groups {
			actions := make([]string, len(gp.Actions))
			for j, a := range gp.Actions {
				actions[j] = string(a)
			}
			role.Groups[i] = GroupPermission{
				Actions:   actions,
				Group:     gp.Group,
				GroupType: string(gp.GroupType),
			}
		}
	}

	return role
}
