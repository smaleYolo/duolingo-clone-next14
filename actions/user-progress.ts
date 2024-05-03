"use server";

import {auth, currentUser} from "@clerk/nextjs";
import {getCourseById, getUserProgress, getUserSubscription} from "@/db/queries";
import {challengeProgress, challenges, userProgress} from "@/db/schema";
import db from "@/db/drizzle";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {and, eq} from "drizzle-orm";
import {POINTS_TO_REFILL} from "@/constants";


// Функция обновления или вставки прогресса пользователя
export const upsertUserProgress = async (courseId: number) => {
    const {userId} = auth(); // Аутентификация пользователя
    const user = await currentUser(); // Получение текущего пользователя

    if(!userId || !user) {
        throw new Error('Unauthorized'); // Проверка на авторизацию
    }

    const course = await getCourseById(courseId); // Получение данных курса

    if(!course) {
        throw new Error('Course not found'); // Проверка существования курса
    }

    if (!course.units.length || !course.units[0].lessons.length) {
        throw new Error('Course is empty');
    }

    const existingUserProgress = await getUserProgress(); // Получение текущего прогресса пользователя

    if(existingUserProgress) {
        await db.update(userProgress).set({
            activeCourseId: courseId,
            userName: user.firstName || 'User',
            userImageSrc: user.imageUrl || '/mascot.svg'
        })

        revalidatePath('/courses'); // Обновление кэша для курсов
        revalidatePath('/learn'); // Обновление кэша для страницы учебы
        redirect('/learn') // Переадресация на страницу учебы
    } else {
        await db.insert(userProgress).values({
            userId,
            activeCourseId: courseId,
            userName: user.firstName || 'User',
            userImageSrc: user.imageUrl || '/mascot.svg'
        })

        revalidatePath('/courses');
        revalidatePath('/learn');
        redirect('/learn')
    }
}


export const reduceHearts = async (challengeId: number) => {
    const { userId } = auth();

    if (!userId){
        throw new Error('Unauthorized');
    }

    const currentUserProgress = await getUserProgress();
    const userSubscription = await getUserSubscription();

    const challenge = await db.query.challenges.findFirst({
        where: eq(challenges.id, challengeId)
    })

    if (!challenge) {
        throw new Error('Challenge not found');
    }

    const lessonId = challenge.lessonId

    const existingChallengeProgress = await db.query.challengeProgress.findFirst({
        where: and(
            eq(challengeProgress.userId, userId),
            eq(challengeProgress.challengeId, challengeId),
        ),
    })

    const isPractice = !!existingChallengeProgress;

    if (isPractice){
        return { error: 'practice' }
    }

    if (!currentUserProgress) {
        throw new Error('User progress not found');
    }

    if (userSubscription?.isActive) {
        return {error: 'subscription'};
    }

    if (currentUserProgress.hearts === 0) {
        return { error: 'hearts' }
    }

    await db.update(userProgress).set({
        hearts: Math.max(currentUserProgress.hearts - 1, 0),
    })
        .where(
            eq(userProgress.userId, userId)
        );

    revalidatePath('/shop');
    revalidatePath('/learn');
    revalidatePath('/quests');
    revalidatePath('/leaderboard');
    revalidatePath(`/lesson/${lessonId}`);
}


export const refillHearts = async () => {
    const currentUserProgress = await getUserProgress();

    if(!currentUserProgress){
        throw new Error('User progress not found');
    }

    if(currentUserProgress.hearts === 5){
        throw new Error('Hearts are already full');
    }

    if(currentUserProgress.points < POINTS_TO_REFILL){
        throw new Error('Not enough points')
    }

    await db.update(userProgress).set({
        hearts: 5,
        points: currentUserProgress.points - POINTS_TO_REFILL,
    })
        .where(eq(userProgress.userId, currentUserProgress.userId))

    revalidatePath('/shop')
    revalidatePath('/learn')
    revalidatePath('/quests')
    revalidatePath('/leaderboard')
}