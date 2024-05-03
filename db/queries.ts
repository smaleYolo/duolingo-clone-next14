import {cache} from 'react';
import {eq} from "drizzle-orm";
import {auth} from "@clerk/nextjs";

import db from '@/db/drizzle';
import {challengeProgress, challenges, courses, lessons, units, userProgress, userSubscription} from "@/db/schema";

export const getUserProgress = cache(async () => {
    const {userId} = auth();

    if (!userId) return null

    const data = await db.query.userProgress.findFirst({
        where: eq(userProgress.userId, userId),
        with: {
            activeCourse: true
        }
    })

    return data
})

// Функция getUnits используется для получения учебных блоков (unit) для активного курса пользователя.
// Используется кэширование для улучшения производительности.
export const getUnits = cache(async () => {
    const {userId} = auth();
    // Получаем текущий прогресс пользователя.
    const userProgress = await getUserProgress();

    // Если у пользователя нет активного курса, возвращаем пустой массив.
    if (!userId || !userProgress?.activeCourseId) {
        return [];
    }

    // Запрос к базе данных для получения учебных блоков (unit),
    // которые принадлежат активному курсу пользователя.
    const data = await db.query.units.findMany({
        orderBy: (units, {asc}) => [asc(units.order)],
        // Условие выборки: id курса должно соответствовать активному курсу в прогрессе пользователя.
        where: eq(units.courseId, userProgress.activeCourseId),
        // Запрос включает в себя вложенные данные: уроки, задания в уроках и прогресс по заданиям.
        with: {
            lessons: {
                orderBy: (lessons, {asc}) => [asc(lessons.order)],
                with: {
                    challenges: {
                        orderBy: (challenges, {asc}) => [asc(challenges.order)],
                        with: {
                            challengeProgress: {
                                where: eq(
                                    challengeProgress.userId,
                                    userId
                                )
                            } // Подгрузка прогресса по каждому заданию.
                        }
                    }
                }
            }
        }
    });

    // Нормализация данных для добавления статуса завершенности урока на основе прогресса по заданиям.
    const normalizedData = data.map((unit) => {
        const lessonsWithCompletedStatus = unit.lessons.map((lesson) => {
            if(lesson.challenges.length === 0){
                return {...lesson, completed: false}
            }
            // Проверяем, все ли задания в уроке выполнены.
            const allCompletedChallenges = lesson.challenges.every((challenge) => {
                return challenge.challengeProgress
                    && challenge.challengeProgress.length > 0
                    && challenge.challengeProgress.every((progress) => progress.completed);
            });
            // Возвращаем урок с дополнительным полем, показывающим, выполнен ли урок полностью.
            return {...lesson, completed: allCompletedChallenges};
        });
        // Возвращаем обновленный учебный блок с уроками, имеющими статус завершенности.
        return {...unit, lessons: lessonsWithCompletedStatus};
    });
    // Возвращаем нормализованные данные.
    return normalizedData
});

export const getCourses = cache(async () => {
    const data = await db.query.courses.findMany();

    return data;
})

export const getCourseById = cache(async (courseId: number) => {
    const data = await db.query.courses.findFirst({
        where: eq(courses.id, courseId),
        with: {
            units: {
                orderBy: (units, {asc}) => [asc(units.order)],
                with: {
                    lessons: {
                        orderBy: (lessons, { asc }) => [asc(lessons.order)],
                    }
                }
            }
        }
    })

    return data
})

// Функция getCourseProgress предназначена для получения текущего прогресса пользователя по активному курсу.
// Она использует кэширование для оптимизации производительности.
export const getCourseProgress = cache(async () => {
    // Аутентификация пользователя и получение его идентификатора.
    const {userId} = auth();
    // Получение текущего прогресса пользователя, включая идентификатор активного курса.
    const userProgress = await getUserProgress();

    // Проверка на наличие идентификатора пользователя и активного курса.
    if (!userId || !userProgress?.activeCourseId) {
        return null; // Возвращаем null, если данные неполные.
    }

    // Запрос к базе данных для получения списка учебных блоков (unit) активного курса,
    // отсортированных по полю order.
    const unitsInActiveCourse = await db.query.units.findMany({
        orderBy: (units, {asc}) => [asc(units.order)], // Сортировка учебных блоков по возрастанию.
        where: eq(units.courseId, userProgress.activeCourseId), // Условие поиска по id курса.
        with: {
            lessons: { // Вложенный запрос для уроков в учебном блоке.
                orderBy: (lessons, {asc}) => [asc(lessons.order)], // Сортировка уроков по порядку.
                with: {
                    unit: true, // Включение информации о блоке для каждого урока.
                    challenges: { // Запрос заданий для уроков.
                        with: {
                            challengeProgress: { // Запрос прогресса по каждому заданию.
                                where: eq(challengeProgress.userId, userId) // Фильтр по userId.
                            }
                        }
                    }
                }
            }
        }
    });

    // Поиск первого незавершённого урока в активном курсе.
    // Проходим по всем урокам во всех блоках.
    const firstUncompletedLesson = unitsInActiveCourse
        .flatMap((unit) => unit.lessons) // Создание одномерного массива уроков из всех блоков.
        .find((lesson) => { // Поиск первого урока, в котором есть хотя бы одно незавершённое задание.
            return lesson.challenges.some((challenge) => {
                // Проверяем, есть ли незавершённые задания (отсутствует прогресс или прогресс пуст).
                return !challenge.challengeProgress
                    || challenge.challengeProgress.length === 0
                    || challenge.challengeProgress.some((progress) => progress.completed === false);
            });
        });

    // Возвращаем объект с данными о первом незавершённом уроке и его ID.
    return {
        activeLesson: firstUncompletedLesson,
        activeLessonId: firstUncompletedLesson?.id,
    };
});

export const getLesson = cache(async (id?: number) => {
    const {userId} = auth();

    if (!userId) {
        return null;
    }

    const courseProgress = await getCourseProgress();

    const lessonId = id || courseProgress?.activeLessonId;

    if (!lessonId) {
        return null;
    }

    const data = await db.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
        with: {
            challenges: {
                orderBy: (challenges, {asc}) => [asc(challenges.order)],
                with: {
                    challengeOptions: true,
                    challengeProgress: {
                        where: eq(challengeProgress.userId, userId)
                    },
                },
            },
        },
    });

    if (!data || !data.challenges) {
        return null;
    }

// Нормализация данных о заданиях для урока. Создаем новый массив, где каждое задание дополнено статусом выполнения.
    const normalizedChallenges = data.challenges.map((challenge) => {
        // Проверяем, есть ли запись о прогрессе по текущему заданию для данного пользователя.
        // Если прогресс существует и он не пустой, считаем задание выполненным.
        const completed = challenge.challengeProgress
            && challenge.challengeProgress.length > 0
            && challenge.challengeProgress.every((progress) => progress.completed);

        // Возвращаем задание с добавлением поля 'completed', указывающего на его статус выполнения.
        // Это позволяет легко определить, какие задания уже были завершены пользователем.
        return {...challenge, completed};
    })

    return {...data, challenges: normalizedChallenges}
})

export const getLessonPercentage = cache(async () => {
    const courseProgress = await getCourseProgress();

    if(!courseProgress?.activeLessonId) {
        return 0
    }

    const lesson = await getLesson(courseProgress.activeLessonId)

    if(!lesson) {
        return 0
    }

    const completedChallenges = lesson.challenges.filter((challenge) => challenge.completed)
    const percentage = Math.round(
        (completedChallenges.length / lesson.challenges.length) * 100
    )

    return percentage
})

const DAY_IN_MS = 86_400_000;
export const getUserSubscription = cache(async () => {
    const { userId } = auth();

    if (!userId) return null;

    const data = await db.query.userSubscription.findFirst({
        where: eq(userSubscription.userId, userId),
    });

    if (!data) return null;

    const isActive =
        data.stripePriceId &&
        data.stripeCurrentPeriodEnd?.getTime() + DAY_IN_MS > Date.now();

    return {
        ...data,
        isActive: !!isActive,
    };
});


export const getTopTenUsers = cache(async () => {
    const { userId } = auth();

    if (!userId) return [];

    const data = await db.query.userProgress.findMany({
        orderBy: (userProgress, {desc}) => [desc(userProgress.points)],
        limit: 10,
        columns: {
            userId: true,
            userName: true,
            userImageSrc: true,
            points: true,
        }
    })

    return data
})