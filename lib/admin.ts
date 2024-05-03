import {auth} from "@clerk/nextjs";

const adminIds = [
    'user_2fGGTyKzZPQt57aXoM6F4us2o0v',
];

export const getIsAdmin = () => {
    const { userId } = auth()

    if(!userId) return false

    return adminIds.indexOf(userId) !== -1
}