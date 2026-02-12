const deletedUserIds = new Set<string>()

export const markUserDeleted = (userId: string) => {
  deletedUserIds.add(userId)
}

export const isUserDeleted = (userId: string | null | undefined) => {
  if (!userId) {
    return false
  }

  return deletedUserIds.has(userId)
}

export const resetDeletedUsersForTests = () => {
  deletedUserIds.clear()
}
